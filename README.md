node-red-contrib-aws-iot
====================

A Node-Red node to read and write to the Amazon Web Services AWS IoT.

Install
-------

Run the following command in the root directory of your Node-RED install

    npm install node-red-contrib-aws-iot-hub


Usage
-----
					
+ Install your AWS certificates into your local folder where node-red can reach your directory
	
	Example: 
```
	/root/.agent/certs/-
					|--YourThingName.private.key
					|--YourThingName.cert.pem
					|--root-CA.crt
```
	YourThingName is the AWS Thing name what is the value you keyin when creating your thing/device.
	
+ Setup the **node-red-contrib-aws-iot-hub** node with *AWS Certs* path pointed to /root/.agent/certs/
	
	Example: 
```
	awsCerts = /root/.agent/certs/
```

+ The final configuration will be used in the **node-red-contrib-aws-iot-hub** code look likes:

```
	keyPath : '/root/.agent/certs/YourThingName.private.key',
	certPath : '/root/.agent/certs/YourThingName.cert.pem',
	caPath : '/root/.agent/certs/root-CA.crt',
	clientId : YourThingName,
	region : us-east-1
```

See more at https://github.com/aws/aws-iot-device-sdk-js/blob/master/README.md#certificate-configuration 
