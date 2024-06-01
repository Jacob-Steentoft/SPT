"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaidTimeAdjuster = void 0;
const CustomRaidTimes_1 = require("../CustomRaidTimes");
const LocationProcessor_1 = require("../processors/LocationProcessor");
/**
 * RaidTimeAdjuster class.
 *
 * Handles the logic needed to set a new raid time.
 */
class RaidTimeAdjuster {
    location;
    locationName;
    constructor(location) {
        this.location = location;
        this.locationName = LocationProcessor_1.LocationProcessor.locationNames[location.Id.toString().toLowerCase()];
    }
    /**
     * Adjusts the raid time of the location.
     */
    adjust() {
        const originalTime = this.location.EscapeTimeLimit;
        if (CustomRaidTimes_1.CustomRaidTimes.config.raidTimes.overrideAll) {
            this.location.EscapeTimeLimit = Number(CustomRaidTimes_1.CustomRaidTimes.config.raidTimes.override);
        }
        else {
            const customTime = CustomRaidTimes_1.CustomRaidTimes.config.raidTimes.customTimes[this.locationName.config];
            this.location.EscapeTimeLimit = Number(customTime);
        }
        if (CustomRaidTimes_1.CustomRaidTimes.config.general.debug && this.location.EscapeTimeLimit !== originalTime) {
            CustomRaidTimes_1.CustomRaidTimes.logger.log(`CustomRaidTimes: ${this.locationName.human} raid time change from ${originalTime} minutes to ${this.location.EscapeTimeLimit} minutes.`, "gray");
        }
    }
}
exports.RaidTimeAdjuster = RaidTimeAdjuster;
//# sourceMappingURL=RaidTimeAdjuster.js.map