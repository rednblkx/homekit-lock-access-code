# HomeKit Access Code Lock Functionality

This documentation is intended only for educational purposes. All information provided here is based on reverse engineering and guessing which means information might be incomplete or straight up missing .

## Overview

Keypads are supported by Homekit as an authentication mechanism for a HomeKit compatible lock that also implement Guest Sharing, which means you can assign access codes to people that are not part of your Apple Home.

A lock with access codes support is just a simple HomeKit Lock with the additional Service and Characteristics.

The required Services and Characteristics are already present in well-known projects like HAP-Python or HAP-NodeJS and this documentation will attempt to clarify their use.

Note that all Services and Characteristics defined in HAP follow the below format for their UUID:

```
00000263-0000-1000-8000-0026BB765291
|      | |                         |
 ------   -------------------------
   ID          Base(HomeKit ID?)
```
The base is a constant for all defined Services and Characteristics and only the first 8 characters change which their actual ID. In this Documentation only the ID will be mentioned.


## Services
| Name        | ID  |
| ----------- | --- |
| Access Code | 260 |

## Characteristics

| Name                                | ID      | Type    | Purpose                                                                              |
| ----------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------ |
| Configuration State                 | 263     | UINT16  | *unknown*                                                                            |
| Access Code Control Point           | 262     | TLV8    | Access Code Provisioning                                                             |
| Access Code Supported Configuration | 261     | TLV8    | Allowed Character Set, Min & Max Value for the PIN and maximum allowed Access Codes  |

### 1. Access Code Supported Configuration

This characteristic will initially be read during pairing to acquire the required configuration like the minimum and maximum characters allow for an Access Code.
This will also be read randomly(presumably) by the controller, assuming to check if something changed following a software update or something.

### 2. Access Code Control Point

This where most of the communication will take place besides the initial query to "Access Code Supported Configuration" upon pairing and at random to get the configuration.

The controller always sends a Write Request containing TLV8 object encoded in Base64 to the lock and expects a direct response to this request.


Root TLV8:

| Description                                               | Type        | Length       | Value                                                                       | Presence               |
| --------------------------------------------------------- | ----------- | ------------ | --------------------------------------------------------------------------- | ---------------------- |
| Operation                                                 | 1           | 1            | `1: List `<br>`2: Read`<br>`3: Add`<br>`4: Update`<br>`5: Remove`           | Request and Response   |
| Access Code Control Request                               | 2           | N            | Sub-TLV8, see table "[Access Code Request](#access-code-control-request)"   | Request Only           |
| Access Code Control Response                              | 3           | N            | Sub-TLV8, see table "[Access Code Response](#access-code-control-response)" | Response Only          |

**Important Note:** The operation received in the request has to be included in the response at least for the Add operation as the HomeKit Daemon will just crash if not present, wild i know.

### - Access Code Control Request

| Description                                               | Type        | Length                  | Value                                              | Presence                |
| --------------------------------------------------------- | ----------- | ----------------------- | -------------------------------------------------- | ----------------------- |
| Identifier                                                | 1           | N                       | The identifier of the Access Code                  | Read & Remove Operation |
| Access Code                                               | 2           | N(Access Code Length)   | The actual Access Code in ASCII Format             | Add Operation           |

### - Access Code Control Response

| Description                                               | Type        | Length                  | Value                                                       | Presence       |
| --------------------------------------------------------- | ----------- | ----------------------- | ----------------------------------------------------------- | -------------- |
| Identifier                                                | 1           | N                       | The identifier of the Access Code                           | All Operations |
| Access Code                                               | 2           | N(Access Code Length)   | The actual Access Code in ASCII Format                      | All Operations |
| Flags                                                     | 3           | 1                       | Seems to be used to set up restrictions, values not known   | All Operations |
| Status Code                                               | 4           | 1                       | See Table "[Response Status Codes](#response-status-codes)" | All Operations |

**Note** For the Read and List Operation the Controller expects to receive all access codes in one response, this is achieved by Bulk Operations, multiple "Access Code Control Response" TLV Tags separated by a padding of 2 bytes of 0x0 will be sent out as a response for each access code.

#### Response Status Codes

| ID    | Description                            |
| ----- | -------------------------------------- |
|  0    |  Success                               |
|  1    |  Unknown                               |
|  2    |  Exceeded Maximum Allowed AccessCodes  |
|  3    |  Too Many Bulk Operations              |
|  4    |  Duplicate Access Code Configuration   |
|  5    |  Smaller than Min Length               |
|  6    |  Larger than Max Length                |
|  7    |  Invalid Character                     |
|  8    |  Invalid Request                       |
|  9    |  Does not exist                        |

### Example Add request

#### Request

```
01 01 03                --> Add Operation (0x3)
02 06                   --> Access Code Control Request (0x2)
    02 04 31 32 33 34   --> Access Code (1234 - ASCII Format)
```

#### Response

```
01 01 03                --> Add Operation (0x3)

03 0F                   --> Access Code Control Response (0x3)
    01 01 01            --> Access Code Identifier (0x1)
    02 04 31 32 33 34   --> Access Code (1234 - ASCII Format)
    03 01 00            --> Access Code Flags (0x0)
    04 01 00            --> Status Code (0x0)
```

### Example List Request

#### Request

```
01 01 01 --> List Operation (0x1)
```

#### Response

```
01 01 01                --> List Operation

03 0f                   --> Access Code Control Response
    01 01 00            --> Identifier
    02 04 31 32 33 34   --> Access Code
    03 01 00            --> Flags
    04 01 00            --> Status

00 00 --> Padding

03 10                   --> Access Code Control Response
    01 01 01            --> Identifier
    02 05 35 36 37 38 39 --> Access Code
    03 01 00            --> Flags
    04 01 00            --> Status

00 00 --> Padding

03 0f                   --> Access Code Control Response
    01 01 02            --> Identifier
    02 04 32 34 36 38   --> Access Code
    03 01 00            --> Flags
    04 01 00            --> Status

```

## Example Read Request

#### Request

```
01 01 02        --> Read Operation

02 03           --> Access Code Control Request
    01 01 00    --> Access Code Identifier
00 00   --> Padding
02 03           --> Access Code Control Request
    01 01 01    --> Access Code Identifier
00 00   --> Padding
02 03           --> Access Code Control Request
    01 01 02    --> Access Code Identifier
```

#### Response

```
01 01 02                --> Read Operation
03 0f                   --> Access Code Control Response
    01 01 00            --> Access Code Identifier
    02 04 31 32 33 34   --> Access Code
    03 01 00            --> Flags
    04 01 00            --> Status Code
00 00       --> Padding
03 10                       --> Access Code Control Response
    01 01 01                --> Access Code Identifier
    02 05 35 36 37 38 39    --> Access Code
    03 01 00                --> Flags
    04 01 00                --> Status Code
00 00       --> Padding
03 0f                   --> Access Code Control Response
    01 01 02            --> Access Code Identifier
    02 04 32 34 36 38   --> Access Code
    03 01 00            --> Flags
    04 01 00            --> Status Code
```

## Example Remove Access Code

#### Request

```
01 01 05        --> Remove Operation
02 03           --> Access Control Request
    01 01 02    --> Access Code Identifier
```

#### Response

```
01 01 05                --> Remove Operation
03 0f
    01 01 02            --> Access Code Identifier
    02 04 32 34 36 38   --> Access Code
    03 01 00            --> Flags
    04 01 00            --> Status Code
```

## Example Update Access Code

Oddly, the Home App seems to be using the Add operation

### Request

```
01 01 03                --> Add Operation
02 06                   --> Access Code Request
    02 04 39 39 39 39   --> Access Code
```

### Response

```
01 01 03                --> Add Operation
03 0f                   --> Access Code Response
    01 01 02            --> Access Code Identifier
    02 04 39 39 39 39   --> Access Code
    03 01 00            --> Flags
    04 01 00            --> Status Code
```

## Demo

You can find a demo written in JavaScript in the demo folder, just make sure to have nodejs and npm installed and then run `npm run serve`.