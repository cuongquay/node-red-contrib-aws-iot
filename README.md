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
					|--YourUniqueClientIdentifier.private.key
					|--YourUniqueClientIdentifier.cert.pem
					|--root-CA.crt
```
	YourUniqueClientIdentifier is the AWS thing name what you put when creating your thing.
	
+ Setup the **node-red-contrib-aws-iot-hub** node with *AWS Certs* path pointed to /root/.awscerts/
	
	Example: 
```
	awsCerts = /root/.agent/certs/
```

+ The final configuration will be used in the **node-red-contrib-aws-iot-hub** code look likes:

```
	keyPath : '/root/.agent/certs/YourUniqueClientIdentifier.private.key',
	certPath : '/root/.agent/certs/YourUniqueClientIdentifier.cert.pem',
	caPath : '/root/.agent/certs/root-CA.crt',
	clientId : YourUniqueClientIdentifier,
	region : us-east-1
```

See more at https://github.com/aws/aws-iot-device-sdk-js/blob/master/README.md#certificate-configuration 
