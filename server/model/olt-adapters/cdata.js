const BaseOltAdapter = require("./base-olt-adapter");

class CdataOltAdapter extends BaseOltAdapter {
    /**
     *
     */
    constructor() {
        super();
        this.id = "cdata";
        this.name = "C-DATA GPON Adapter Profile";
        this.vendor = "C-DATA";
        this.models = ["FD1608GS", "FD1616GS", "FD1704GS"];
        this.supportedFirmwares = ["V1.*", "V2.*"];

        this.oids = {
            ...this.oids,
            boardCpuUsage: "1.3.6.1.4.1.37091.4.1.1",
            boardMemUsage: "1.3.6.1.4.1.37091.4.1.2",
            boardTemperature: "1.3.6.1.4.1.37091.4.1.3",
        };

        this.discoveryRules = {
            sysObjectIDPrefix: "1.3.6.1.4.1.37091",
            sysDescrRegex: /c-data|cdata|fd16/i,
        };
    }
}

module.exports = CdataOltAdapter;
