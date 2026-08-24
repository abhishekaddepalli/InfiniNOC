const BaseOltAdapter = require("./base-olt-adapter");

class DasanOltAdapter extends BaseOltAdapter {
    /**
     *
     */
    constructor() {
        super();
        this.id = "dasan";
        this.name = "DASAN Zhone GPON Adapter Profile";
        this.vendor = "DASAN";
        this.models = ["V5824G", "V8102", "V8106", "V5808"];
        this.supportedFirmwares = ["V5.*", "V6.*"];

        this.oids = {
            ...this.oids,
            boardCpuUsage: "1.3.6.1.4.1.6296.101.1.1.1",
            boardMemUsage: "1.3.6.1.4.1.6296.101.1.1.2",
            boardTemperature: "1.3.6.1.4.1.6296.101.1.1.3",
            onuOnlineStatus: "1.3.6.1.4.1.6296.101.9.1.1.2",
        };

        this.discoveryRules = {
            sysObjectIDPrefix: "1.3.6.1.4.1.6296",
            sysDescrRegex: /dasan|zhone|v5824/i,
        };
    }
}

module.exports = DasanOltAdapter;
