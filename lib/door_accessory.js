const TuyaWebApi = require('./tuyawebapi');
const BaseAccessory = require('./base_accessory')

let PlatformAccessory;
let Accessory;
let Service;
let Characteristic;
let UUIDGen;

class DoorAccessory extends BaseAccessory {
  constructor(platform, homebridgeAccessory, deviceConfig) {

    ({ Accessory, Characteristic, Service } = platform.api.hap);

    super(
      platform,
      homebridgeAccessory,
      deviceConfig,
      Accessory.Categories.GARAGE_DOOR_OPENER
    )

    let targetState = DoorState.CLOSED; //Closed
    let currentState; // = DoorState.CLOSED;
    let operating = false;

    this.service.getCharacteristic(Characteristic.CurrentDoorState)
      .on('get', (callback) => {
        // Retrieve state from cache
        if (this.hasValidCache()) {
          currentState = this.getCachedState(Characteristic.CurrentDoorState);
          this.log("Current door state in get CurrentDoorState = ", doorStateToString(currentState));
          callback(null, this.getCachedState(Characteristic.CurrentDoorState));
        }
        else {

          // Retrieve device state from Tuya Web API
          this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
            this.log('[GET][%s] Characteristic.CurrentDoorState: %s', this.homebridgeAccessory.displayName, data.state);
            this.getCachedState(Characteristic.CurrentDoorState, data.state);
            currentState = data.state ? DoorState.OPEN : DoorState.CLOSED;
            this.log("Current Door state from Tuya Web API = ", doorStateToString(data.state));
            callback(null, data.state);
          }).catch((error) => {
            this.log.error('[GET][%s] Characteristic.On Error: %s', this.homebridgeAccessory.displayName, error);
            this.invalidateCache();
            callback(error);
          });
        }
      });

    this.service.getCharacteristic(Characteristic.TargetDoorState)
      .on('get', (callback) => {
        this.log.debug("get TargetDoorState targetState = ", doorStateToString(targetState));
        callback(null, targetState);
      })
      .on('set', (target, callback) => {
        targetState = target;

        this.log.debug("set TargetDoorState targetState = ", doorStateToString(targetState));

        var isOpen;

        // Retrieve state from cache
        if (this.hasValidCache()) {
          this.log.debug("set TargetDoorState cached DoorState = ", doorStateToString(this.getCachedState(Characteristic.CurrentDoorState)));
          isOpen = this.getCachedState(Characteristic.CurrentDoorState) == DoorState.OPEN;
        }
        else {
          // Retrieve device state from Tuya Web API
          this.platform.tuyaWebApi.getDeviceState(this.deviceId).then((data) => {
            this.log.debug('[GET][%s] Characteristic.CurrentDoorState: %s', this.homebridgeAccessory.displayName, doorStateToString(data.state));
            this.getCachedState(Characteristic.CurrentDoorState, data.state);
            isOpen = data.state;
          }).catch((error) => {
            this.log.error('[GET][%s] Characteristic.On Error: %s', this.homebridgeAccessory.displayName, error);
            this.invalidateCache();
            callback(error);
          });
        }

        if ((target == DoorState.OPEN && !isOpen) || (target == DoorState.CLOSED && isOpen)) {
          operating = true;
          if (target == DoorState.OPEN) {
              currentState = DoorState.OPENING;
          } else {
              currentState = DoorState.CLOSING;
          }
          this.log.debug("Triggering Door Relay - Garage Door State =", doorStateToString(currentState));
        }

        // Set device state in Tuya Web API
        const value = target;
        this.platform.tuyaWebApi.setDeviceState(this.deviceId, 'turnOnOff', { value: value }).then(() => {
          this.log.debug('[SET][%s] Characteristic.CurrentDoorState: %s', this.homebridgeAccessory.displayName, doorStateToString(value));
          this.setCachedState(Characteristic.CurrentDoorState, currentState);
          callback();
        }).catch((error) => {
          this.log.error('[SET][%s] Characteristic.CurrentDoorState Error: %s', this.homebridgeAccessory.displayName, error);
          this.invalidateCache();
          callback(error);
        });

      });
  }

  updateState(data) {
    const state = data.state ? DoorState.OPEN : DoorState.CLOSED;
    this.log.debug('[UPDATING][%s]:', this.homebridgeAccessory.displayName, doorStateToString(state));
    this.service
      .getCharacteristic(Characteristic.CurrentDoorState)
      .updateValue(state);
    this.setCachedState(Characteristic.CurrentDoorState, state);
  }
}

doorStateToString = function(state) {
  switch (state) {
    case DoorState.OPEN:
      return "OPEN";
    case DoorState.CLOSED:
      return "CLOSED";
    case DoorState.STOPPED:
      return "STOPPED";
    case DoorState.OPENING:
      return "OPENING";
    case DoorState.CLOSING:
      return "CLOSING";
    default:
      return "UNKNOWN";
    }
  }

module.exports = DoorAccessory;
