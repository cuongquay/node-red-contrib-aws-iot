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

		this.connect = function(clientId, reconnect, callback) {
			clientId = clientId || n.clientId;
			var awsCerts = n.awscerts || ".";
			if (!self.device || reconnect) {
				self.log("Attempt to connect to " + n.mode + " with " + clientId + " from: " + awsCerts);
				if (n.mode == "shadow") {
					self.device = require('aws-iot-device-sdk').thingShadow({
						keyPath : awsCerts + '/' + clientId + '-private.pem.key',
						certPath : awsCerts + '/' + clientId + '-certificate.pem.crt',
						caPath : awsCerts + '/root-CA.crt',
						clientId : clientId,
						region : n.region
					});
				} else {
					self.device = require('aws-iot-device-sdk').device({
						keyPath : awsCerts + '/' + clientId + '-private.pem.key',
						certPath : awsCerts + '/' + clientId + '-certificate.pem.crt',
						caPath : awsCerts + '/root-CA.crt',
						clientId : clientId,
						region : n.region
					});
				}
				if (self.device) {
					self.device.on('connect', function() {
						callback('connected');
					});
					self.device.on('reconnect', function() {
						callback('reconnected');
					});
					self.device.on('error', function(error) {
						callback('error', error);
					});
					self.device.on('offline', function() {
						callback('offline');
					});
				}
			} else if (self.device) {
				callback('ready');
			}
		};

		self.on('close', function() {
			self.log("closed " + n.name + " ok");
			if (self.device) {
				if (n.mode == "shadow") {
					self.device.unregister(self.name);
					self.device.end();
				} else {
					self.device.end();
				}
			}

		});
	}


	RED.nodes.registerType("aws-iot-device", awsNodeBroker);

	function awsMqttNodeIn(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);

		var self = this;
		self.on("input", function(msg) {
			if (self.awsIot) {
				self.awsIot.connect(msg.clientId, msg.reconnect, function(event) {
					self.awsIot.connect(msg.clientId, msg.reconnect, function(event, error) {
						if (event == "ready" || event == "connected") {
							self.awsIot.device.subscribe(n.topic);
							self.awsIot.device.on('message', function(topic, payload) {
								if ( typeof payload === "string") {
									payload = JSON.parse(payload);
								}
								self.log('onMessage: ' + topic + ", " + payload.toString());
								self.send({
									topic : topic,
									payload : payload
								});
							});
						}
					});
				});
			} else {
				self.error("aws-mqtt in is not configured");
			}
		});
	}

	RED.nodes.registerType("aws-mqtt in", awsMqttNodeIn);

	function awsMqttNodeOut(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);

		var self = this;
		var options = {
			qos : n.qos || 0,
			retain : false
		};
		self.on("input", function(msg) {
			if (self.awsIot) {
				self.awsIot.connect(msg.clientId, msg.reconnect, function(event, error) {
					if (event == "ready" || event == "connected") {
						if (!Buffer.isBuffer(msg.payload)) {
							if ( typeof msg.payload === "object") {
								msg.payload = JSON.stringify(msg.payload);
							} else if ( typeof msg.payload !== "string") {
								msg.payload = "" + msg.payload;
							}
						}
						self.awsIot.device.publish(msg.topic || n.topic, msg.payload, options);
					}
				});
			} else {
				self.error("aws-mqtt out is not configured");
			}
		});
	}


	RED.nodes.registerType("aws-mqtt out", awsMqttNodeOut);

	function awsThingShadowNodeFunc(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);

		var self = this;
		self.on("input", function(msg) {
			if (self.awsIot) {
				self.awsIot.connect(msg.clientId, msg.reconnect, function(event, error) {
					if (event == "ready" || event == "connected") {
						self.awsIot.device.register(self.awsIot.name, {
							ignoreDeltas : true,
							persistentSubscribe : true
						});
						if (n.method == 'get')
							self.clientToken = self.awsIot.device[n.method](self.awsIot.name);
						else
							self.clientToken = self.awsIot.device[n.method](self.awsIot.name, msg.payload);
						self.awsIot.device.on('message', function(topic, payload) {
							self.log('onMessage: ' + topic + ", " + payload.toString());
							self.send({
								type : 'message',
								topic : topic,
								payload : JSON.parse(payload.toString())
							});
						});
						self.awsIot.device.on('delta', function(thingName, stateObject) {
							self.log('onDelta ' + thingName + ': ' + JSON.stringify(stateObject));
							self.send({
								type : 'delta',
								name : thingName,
								payload : stateObject
							});
						});
						self.awsIot.device.on('status', function(thingName, status, clientToken, stateObject) {
							if (self.clientToken == clientToken) {
								self.log('onStatus: ' + thingName + ", clientToken: " + self.clientToken);
								self.send({
									type : 'status',
									name : thingName,
									token : clientToken,
									payload : {
										status : status,
										stateObject : stateObject,
									}
								});
							}
						});
						self.awsIot.device.on('timeout', function(thingName, clientToken) {
							if (self.clientToken == clientToken) {
								self.send({
									type : 'timeout',
									name : thingName,
									token : clientToken,
									payload : {
									}
								});
							}
						});
					}
				});

			} else {
				self.error("aws-thing shadow is not configured");
			}
		});
	}

	RED.nodes.registerType("aws-thing", awsThingShadowNodeFunc);
};
