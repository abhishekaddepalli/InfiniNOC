const BaseOltAdapter = require("./base-olt-adapter");

class VsolOltAdapter extends BaseOltAdapter {
    /**
     *
     */
    constructor() {
        super();
        this.id = "vsol";
        this.name = "VSOL GPON Adapter Profile";
        this.vendor = "VSOL";
        this.models = ["V1600G1-B", "V1600G2-B", "V1600G0-8P", "V1600G0-16P"];
        this.supportedFirmwares = ["V2.*", "V3.*"];

        this.oids = {
            ...this.oids,
            boardCpuUsage: "1.3.6.1.4.1.37091.3.1.1",
            boardMemUsage: "1.3.6.1.4.1.37091.3.1.2",
            boardTemperature: "1.3.6.1.4.1.37091.3.1.3",
        };

        this.discoveryRules = {
            sysObjectIDPrefix: "1.3.6.1.4.1.37091",
            sysDescrRegex: /vsol|v1600/i,
        };
    }
}

module.exports = VsolOltAdapter;
