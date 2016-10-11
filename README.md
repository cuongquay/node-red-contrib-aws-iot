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
	/root/.awscerts/-
					|--YourUniqueClientIdentifier-private.pem.key
					|--YourUniqueClientIdentifier-certificate.pem.crt
					|--root-CA.crt
```
	YourUniqueClientIdentifier is the AWS thing name what you put when creating your thing.
	
+ Setup the **node-red-contrib-aws-iot-hub** node with *AWS Certs* path pointed to /root/.awscerts/
	
	Example: awsCerts = /root/.awscerts/
	
+ The final configuration will be used in the **node-red-contrib-aws-iot-hub** code look likes:

```
	keyPath : '/root/.awscerts/YourUniqueClientIdentifier-private.pem.key',
	certPath : '/root/.awscerts/YourUniqueClientIdentifier-certificate.pem.crt',
	caPath : '/root/.awscerts/root-CA.crt',
	clientId : YourUniqueClientIdentifier,
	region : us-east-1
```

See more at https://github.com/aws/aws-iot-device-sdk-js/blob/master/README.md#certificate-configuration 