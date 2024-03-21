import {
  Accessory,
  Categories,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Service,
  uuid
} from "hap-nodejs";
import { TlvFactory, IParseError } from 'ber-tlv';

const accessoryUuid = uuid.generate("hap.examples.keypad");
const accessory = new Accessory("Test Accessory", accessoryUuid);

const accessCodeService = new Service.AccessCode("Example Keypad");

let accessCodes : string[] = [];


accessCodeService.setCharacteristic(Characteristic.AccessCodeSupportedConfiguration, "AQEBAgEEAwEQBAEI");
const controlPoint = accessCodeService.getCharacteristic(Characteristic.AccessCodeControlPoint)!;
const confState = accessCodeService.getCharacteristic(Characteristic.ConfigurationState)!;


controlPoint.on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
  console.log("Queried ctrl point: ");
  callback(0, "");
});
controlPoint.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
  console.log("Setting ctrl point: " + value);
  const decTlv = TlvFactory.parse(Buffer.from(value.toString(), 'base64').toString('hex'));
  console.log(decTlv);
  let responseTlv = "";
  let response = "";
  let identifier = "", accessCode = "", flags = "", status = "";
  switch (Number(decTlv[0].value.toString('hex'))){
    case 1:
      responseTlv = "010101";
      if (accessCodes.length > 0) {
        for (let index = 0; index < accessCodes.length; index++) {
          const element = accessCodes[index];
          identifier = TlvFactory.serialize(TlvFactory.primitiveTlv('01', String(index).padStart(2, '0'))).toString('hex');
          accessCode = TlvFactory.serialize(TlvFactory.primitiveTlv('02', Buffer.from(element).toString("hex"))).toString('hex');
          flags = TlvFactory.serialize(TlvFactory.primitiveTlv('03', '00')).toString('hex');
          status = TlvFactory.serialize(TlvFactory.primitiveTlv('04', '00')).toString('hex');
          responseTlv += TlvFactory.serialize(TlvFactory.primitiveTlv('03', identifier + accessCode + flags + status)).toString('hex');
          if (index != (accessCodes.length - 1)) {
            responseTlv += "0000";
          }
        }
      }
      console.log(responseTlv);
      response = Buffer.from(responseTlv, "hex").toString("base64");
      break;
      case 2:
        responseTlv = "010102";
        if (accessCodes.length > 0) {
          for (let index = 1; index < decTlv.length; ++index) {
            const element = decTlv[index];
            const req = TlvFactory.parse(element.value);
            if (req.length > 0) {
              console.log("req valid")
              const reqIdentifier = Number(req[0].value.toString('hex'));
              console.log(`requested identifier ${reqIdentifier}`);
              if (accessCodes[reqIdentifier]) {
                identifier = TlvFactory.serialize(TlvFactory.primitiveTlv('01', String(reqIdentifier).padStart(2, '0'))).toString('hex');
                accessCode = TlvFactory.serialize(TlvFactory.primitiveTlv('02', Buffer.from(accessCodes[reqIdentifier]).toString("hex"))).toString('hex');
                flags = TlvFactory.serialize(TlvFactory.primitiveTlv('03', '00')).toString('hex');
                status = TlvFactory.serialize(TlvFactory.primitiveTlv('04', '00')).toString('hex');
              }
            }
            responseTlv += TlvFactory.serialize(TlvFactory.primitiveTlv('03', identifier + accessCode + flags + status)).toString('hex');
            if (index != (decTlv.length - 1)) {
              responseTlv += "0000";
            }
          }
        }
      console.log(responseTlv);
      response = Buffer.from(responseTlv, "hex").toString("base64");
      break;
    case 3:
      responseTlv = "010103";
      for (let index = 1; index < decTlv.length; index++) {
        const accessReq = TlvFactory.parse(decTlv[index].value);
        if (accessReq.length > 0) {
          if (accessReq[0].tag == '01') {
            const newAccessCode = TlvFactory.parse(accessReq[1].value);
            if (accessCodes[Number(accessReq[0].value.toString('hex'))] && newAccessCode.length > 0) {
              accessCodes[Number(accessReq[0].value.toString('hex'))] = newAccessCode[0].value.toString();
              console.log("updated access code");
              identifier = TlvFactory.serialize(TlvFactory.primitiveTlv('01', accessReq[0].value.toString('hex'))).toString('hex');
              accessCode = TlvFactory.serialize(TlvFactory.primitiveTlv('02', newAccessCode[0].value.toString('hex'))).toString('hex');
              flags = TlvFactory.serialize(TlvFactory.primitiveTlv('03', '00')).toString('hex');
              status = TlvFactory.serialize(TlvFactory.primitiveTlv('04', '00')).toString('hex');
            }
          } else if (accessReq[0].tag == '02') {
              const element = accessReq[0];
              console.log("Added an access code");
              identifier = TlvFactory.serialize(TlvFactory.primitiveTlv('01', String(accessCodes.push(element.value.toString()) - 1).padStart(2, '0'))).toString('hex');
              accessCode = TlvFactory.serialize(TlvFactory.primitiveTlv('02', element.value.toString('hex'))).toString('hex');
              flags = TlvFactory.serialize(TlvFactory.primitiveTlv('03', '00')).toString('hex');
              status = TlvFactory.serialize(TlvFactory.primitiveTlv('04', '00')).toString('hex');
          }
          responseTlv += TlvFactory.serialize(TlvFactory.primitiveTlv('03', identifier + accessCode + flags + status)).toString('hex') + (index != (decTlv.length - 1) ? "0000" : "");
        }
      }
      console.log(responseTlv);
      response = Buffer.from(responseTlv, "hex").toString("base64");
      break;
    case 5:
      responseTlv = "010105";
      const accessReq1 = TlvFactory.parse(decTlv[1].value);
      if (accessReq1.length > 0) {
        if (accessCodes[Number(accessReq1[0].value.toString('hex'))]) {
          accessCode = TlvFactory.serialize(TlvFactory.primitiveTlv('02', Buffer.from(accessCodes[Number(accessReq1[0].value.toString('hex'))]).toString('hex'))).toString('hex');
          accessCodes.splice(Number(accessReq1[0].value.toString('hex')), 1);
          identifier = TlvFactory.serialize(TlvFactory.primitiveTlv('01', accessReq1[0].value.toString('hex'))).toString('hex');
        }
        flags = TlvFactory.serialize(TlvFactory.primitiveTlv('03', '00')).toString('hex');
        status = TlvFactory.serialize(TlvFactory.primitiveTlv('04', '00')).toString('hex');
        responseTlv += TlvFactory.serialize(TlvFactory.primitiveTlv('03', identifier + accessCode + flags + status)).toString('hex');
      }
      console.log(responseTlv);
      response = Buffer.from(responseTlv, "hex").toString("base64");
      break;
  }
  callback(0, response);
});


confState.on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
  console.log("Queried conf state: ");
  callback(0, 0);
});

const lockManagementService = new Service.LockManagement("Lock Management");

const lockService = new Service.LockMechanism("Example Lock");


let lockState : CharacteristicValue = Characteristic.LockCurrentState.UNSECURED;

const currentStateCharacteristic = lockService.getCharacteristic(Characteristic.LockCurrentState);
const targetStateCharacteristic = lockService.getCharacteristic(Characteristic.LockTargetState);

currentStateCharacteristic.on(CharacteristicEventTypes.GET, callback => {
  console.log("Queried current lock state: " + lockState);
  callback(undefined, lockState);
});

targetStateCharacteristic.on(CharacteristicEventTypes.SET, (value, callback) => {
  console.log("Setting lock state to: " + value);
  lockState = value;
  callback();
  setTimeout(() => {
      currentStateCharacteristic.updateValue(lockState);
  }, 1000);
});

accessory.addService(lockManagementService);
accessory.addService(lockService);


accessory.addService(accessCodeService); // adding the service to the accessory

// once everything is set up, we publish the accessory. Publish should always be the last step!
accessory.publish({
  username: "17:51:07:F4:BC:8A",
  pincode: "678-90-876",
  port: 47128,
  category: Categories.DOOR_LOCK, // value here defines the symbol shown in the pairing screen
});

console.log("Accessory setup finished!");
