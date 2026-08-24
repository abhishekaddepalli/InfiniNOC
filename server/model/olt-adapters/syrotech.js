const BaseOltAdapter = require("./base-olt-adapter");

class SyrotechOltAdapter extends BaseOltAdapter {
    /**
     *
     */
    constructor() {
        super();
        this.id = "syrotech";
        this.name = "Syrotech GPON Adapter Profile";
        this.vendor = "Syrotech";
        this.models = ["SY-GPON-OLT-4P", "SY-GPON-OLT-8P", "SY-GPON-OLT-16P"];
        this.supportedFirmwares = ["V2.*", "V3.*"];

        this.oids = {
            ...this.oids,
            boardCpuUsage: "1.3.6.1.4.1.37091.1.1.1.1",
            boardMemUsage: "1.3.6.1.4.1.37091.1.1.1.2",
            boardTemperature: "1.3.6.1.4.1.37091.1.1.1.3",
        };

        this.discoveryRules = {
            sysObjectIDPrefix: "1.3.6.1.4.1.37091",
            sysDescrRegex: /syrotech/i,
        };
    }
}

module.exports = SyrotechOltAdapter;
