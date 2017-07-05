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
	var path = require('path');

	function awsNodeBroker(n) {
		RED.nodes.createNode(this, n);
		this.clientId = n.clientId;
		this.endpoint = n.endpoint;
		var self = this;

		this.connect = function(clientId, reconnect, callback) {
			clientId = clientId || n.clientId;
			clientId = clientId.trim();
			var awsCerts = n.awscerts || ".";
			if (!self.device || reconnect) {
				self.log("Attempt to connect to " + n.mode + " with " + clientId + " from: " + awsCerts);
				var keyPath = path.join(awsCerts, '/' + clientId + '.private.key');
				var certPath = path.join(awsCerts, '/' + clientId + '.cert.pem');
				var caPath = path.join(awsCerts, '/root-CA.crt');
				self.log("Using the certificates that are presented as follows:");
				self.log(" - keyPath   : " + keyPath);
				self.log(" - certPath  : " + certPath);
				self.log(" - caPath    : " + caPath);
				if (n.mode == "shadow") {
					self.device = require('aws-iot-device-sdk').thingShadow({
						keyPath : keyPath,
						certPath : certPath,
						caPath : caPath,
						clientId : clientId,
						host : self.endpoint,
						protocol: 'mqtts'
					});
				} else {
					self.device = require('aws-iot-device-sdk').device({
						keyPath : keyPath,
						certPath : certPath,
						caPath : caPath,
						clientId : clientId,
						host : self.endpoint,
						protocol: 'mqtts'
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
				callback('created');
			} else if (self.device) {
				callback('ready');
			}
		};

		self.on('close', function() {
			self.log("closed " + self.clientId + " ok");
			if (self.device) {
				if (n.mode == "shadow") {
					self.device.unregister(self.clientId);
					self.device.end();
				} else {
					self.device.end();
				}
			}
			self.device = null;
		});
	}


	RED.nodes.registerType("aws-iot-device", awsNodeBroker);

	function awsMqttNodeIn(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);
		var self = this;
		var options = {
			qos: parseInt(n.qos) || 0
		};
		if (self.awsIot) {
			self.status({
				fill : "yellow",
				shape : "ring",
				text : "subscribing..."
			});
			self.awsIot.connect(null, null, function(event, error) {
				if (event == "created") {
					self.awsIot.device.unsubscribe(n.topic);
					self.awsIot.device.subscribe(n.topic, options, function(error, granted) {
						if (!error) {
							self.status({
								fill : "green",
								shape : "ring",
								text : "subscribed"
							});
							self.awsIot.device.on('message', function(topic, payload) {
								if ( typeof payload === "string") {
								} else {
									payload = payload.toString();
								}								
								console.log("RECV<", topic, payload);
								self.send({
									topic : topic,
									payload : payload
								});
							});
						} else {
							self.status({
								fill : "error",
								shape : "ring",
								text : error.message
							});
						}
					});
				}
			});
		} else {
			self.error("aws-mqtt in is not configured");
			self.status({
				fill : "red",
				shape : "ring",
				text : "not configured"
			});
		}
	}


	RED.nodes.registerType("aws-mqtt in", awsMqttNodeIn);

	function awsMqttNodeOut(n) {
		RED.nodes.createNode(this, n);
		this.myDevice = n.device;
		this.awsIot = RED.nodes.getNode(this.myDevice);
		var self = this;
		var options = {
			qos: parseInt(n.qos) || 0
		};
		self.on("input", function(msg) {
			if (self.awsIot) {
				self.awsIot.connect(msg.clientId, msg.reconnect, function(event, error) {
					if ((event == "ready" || event == "created")) {
						if (!Buffer.isBuffer(msg.payload)) {
							if ( typeof msg.payload === "object") {
								msg.payload = JSON.stringify(msg.payload);
							} else if ( typeof msg.payload !== "string") {
								msg.payload = msg.payload.toString();
							}
							msg.payload = new Buffer(msg.payload, "utf-8");
						}
						self.status({
							fill : "blue",
							shape : "ring",
							text : "sending..."
						});
						console.log("SEND>", msg.topic || n.topic, msg.payload);
						self.awsIot.device.publish(msg.topic || n.topic, msg.payload, options, function(error) {
							if (error) {
								self.status({
									fill : "red",
									shape : "ring",
									text : error.message
								});
							} else {
								self.status({
									fill : "green",
									shape : "ring",
									text : "done"
								});
							}
						});
					}
				});
			} else {
				self.error("aws-mqtt out is not configured");
				self.status({
					fill : "red",
					shape : "ring",
					text : "not configured"
				});
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
					if (event == "created") {
						self.awsIot.device.unregister(self.awsIot.clientId);
						self.awsIot.device.register(self.awsIot.clientId, {
							ignoreDeltas : true,
							persistentSubscribe : true
						});
						if (n.method == 'get') {
							self.clientToken = self.awsIot.device[n.method](self.awsIot.clientId);
						} else {
							self.clientToken = self.awsIot.device[n.method](self.awsIot.clientId, msg.payload);
						}
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
