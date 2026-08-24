const BaseOltAdapter = require("./base-olt-adapter");

class OptilinkOltAdapter extends BaseOltAdapter {
    /**
     *
     */
    constructor() {
        super();
        this.id = "optilink";
        this.name = "Optilink GPON Adapter Profile";
        this.vendor = "Optilink";
        this.models = ["OP-OLT-4P", "OP-OLT-8P", "OP-OLT-16P"];
        this.supportedFirmwares = ["V1.*", "V2.*"];

        this.oids = {
            ...this.oids,
            boardCpuUsage: "1.3.6.1.4.1.37091.2.1.1",
            boardMemUsage: "1.3.6.1.4.1.37091.2.1.2",
            boardTemperature: "1.3.6.1.4.1.37091.2.1.3",
        };

        this.discoveryRules = {
            sysObjectIDPrefix: "1.3.6.1.4.1.37091",
            sysDescrRegex: /optilink/i,
        };
    }
}

module.exports = OptilinkOltAdapter;
