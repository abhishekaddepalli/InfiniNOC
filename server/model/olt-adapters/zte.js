const BaseOltAdapter = require("./base-olt-adapter");

class ZteOltAdapter extends BaseOltAdapter {
    /**
     *
     */
    constructor() {
        super();
        this.id = "zte";
        this.name = "ZTE ZXA10 GPON Adapter Profile";
        this.vendor = "ZTE";
        this.models = ["C300", "C320", "C600", "C620", "C650"];
        this.supportedFirmwares = ["V2.1*", "V1.2*", "V3.0*"];

        this.oids = {
            ...this.oids,
            boardCpuUsage: "1.3.6.1.4.1.3902.1012.3.1.3.1.2",
            boardMemUsage: "1.3.6.1.4.1.3902.1012.3.1.3.1.3",
            boardTemperature: "1.3.6.1.4.1.3902.1012.3.1.3.1.4",
            onuOnlineStatus: "1.3.6.1.4.1.3902.1012.3.28.1.1.3",
            onuOpticalRxPower: "1.3.6.1.4.1.3902.1012.3.50.12.1.1",
        };

        this.discoveryRules = {
            sysObjectIDPrefix: "1.3.6.1.4.1.3902",
            sysDescrRegex: /zte|zxa10|c300|c320|c600/i,
        };
    }
}

module.exports = ZteOltAdapter;
