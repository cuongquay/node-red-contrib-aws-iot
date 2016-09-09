/**
 * Copyright 2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
	"use strict";
	function awsNodeBroker(n) {
		RED.nodes.createNode(this, n);
		this.deviceName = n.name;
		var self = this;

		this.connect = function() {
			if (!self.device) {
				self.log("Attemp to connect to " + n.mode + " with " + n.clientId + ", " + n.certId);
				if (n.mode == "shadow") {
					self.device = require('aws-iot-device-sdk').thingShadow({
						keyPath : '../awsCerts/' + n.certId + '-private.pem.key',
						certPath : '../awsCerts/' + n.certId + '-certificate.pem.crt',
						caPath : '../awsCerts/root-CA.crt',
						clientId : n.clientId,
						region : n.region
					});
				} else {
					self.device = require('aws-iot-device-sdk').device({
						keyPath : '../awsCerts/' + n.certId + '-private.pem.key',
						certPath : '../awsCerts/' + n.certId + '-certificate.pem.crt',
						caPath : '../awsCerts/root-CA.crt',
						clientId : n.clientId,
						region : n.region
					});
				}
			}
		};

		this.listen = function(_node) {
			var onDeviceConnect = function() {
				_node.status({
					fill : "green",
					shape : "dot",
					text : "common.status.connected"
				});
			};
			var onDeviceReconnect = function() {
				_node.status({
					fill : "yellow",
					shape : "dot",
					text : "common.status.connecting"
				});
			};
			var onDeviceError = function(error) {
				_node.error(error);
			};
			var onDeviceOffline = function() {
				_node.status({
					fill : "red",
					shape : "dot",
					text : "common.status.disconnected"
				});
			};
			self.device.on('connect', onDeviceConnect);
			self.device.on('reconnect', onDeviceReconnect);
			self.device.on('error', onDeviceError);
			self.device.on('offline', onDeviceOffline);
		};
		self.on('close', function() {
			self.log("closed " + n.name + " ok");
			if (n.mode == "shadow") {
				self.device.unregister(self.name);
				self.device.end();
			} else {
				self.device.end();
			}
		});
	}


	RED.nodes.registerType("aws-iot-device", awsNodeBroker);

	function awsMqttNodeIn(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);

		if (this.awsIot) {
			var self = this;
			this.awsIot.connect();
			this.awsIot.listen(self);
			self.log('Subscribe: ' + this.awsIot.name + ", " + n.topic);
			this.awsIot.device.subscribe(n.topic);
			this.awsIot.device.on('message', function(topic, payload) {
				if ( typeof payload === "string") {
					payload = JSON.parse(payload);
				}
				self.log('onMessage: ' + topic + ", " + payload.toString());
				self.send({
					topic : topic,
					payload : payload
				});
			});
		} else {
			this.error("aws-mqtt in is not configured");
		}
	}


	RED.nodes.registerType("aws-mqtt in", awsMqttNodeIn);

	function awsMqttNodeOut(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);

		if (this.awsIot) {
			var self = this;
			this.awsIot.connect();
			this.awsIot.listen(self);
			var options = {
				qos : n.qos || 0,
				retain : n.retain || false
			};
			self.on("input", function(msg) {
				if (!Buffer.isBuffer(msg.payload)) {
					if ( typeof msg.payload === "object") {
						msg.payload = JSON.stringify(msg.payload);
					} else if ( typeof msg.payload !== "string") {
						msg.payload = "" + msg.payload;
					}
				}
				this.awsIot.device.publish(msg.topic, msg.payload, options);
			});
		} else {
			this.error("aws-mqtt out is not configured");
		}
	}


	RED.nodes.registerType("aws-mqtt out", awsMqttNodeOut);

	function awsThingShadowNodeFunc(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);

		if (this.awsIot) {
			var self = this;
			this.awsIot.connect();
			this.awsIot.listen(self);
			self.log('Register: ' + this.awsIot.name + ", " + n.method);
			this.awsIot.device.register(this.awsIot.name, {
				ignoreDeltas : true,
				persistentSubscribe : true
			});
			self.on("input", function(msg) {
				if (n.method == 'get')
					self.clientToken = this.awsIot.device[n.method](this.awsIot.name);
				else
					self.clientToken = this.awsIot.device[n.method](this.awsIot.name, msg.payload);
			});
			this.awsIot.device.on('message', function(topic, payload) {
				self.log('onMessage: ' + topic + ", " + payload.toString());
				self.send({
					type : 'message',
					topic : topic,
					payload : JSON.parse(payload.toString())
				});
			});
			this.awsIot.device.on('delta', function(thingName, stateObject) {
				self.log('onDelta ' + thingName + ': ' + JSON.stringify(stateObject));
				self.send({
					type : 'delta',
					name : thingName,
					payload : stateObject
				});
			});
			this.awsIot.device.on('status', function(thingName, status, clientToken, stateObject) {
				if (self.clientToken == clientToken) {
					self.log('onStatus: ' + thingName + ", clientToken: " + self.clientToken);
					self.send([{
						name : thingName,
						token : clientToken,
						payload : {
							status : status,
							stateObject : stateObject,
						}
					}, null]);
				}
			});
			this.awsIot.device.on('timeout', function(thingName, clientToken) {
				if (self.clientToken == clientToken) {
					self.send([null, {
						name : thingName,
						token : clientToken,
						payload : {
						}
					}]);
				}
			});
		} else {
			this.error("aws-thing shadow is not configured");
		}
	}


	RED.nodes.registerType("aws-thing", awsThingShadowNodeFunc);
};
