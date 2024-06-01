"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainTimeAdjuster = void 0;
const CustomRaidTimes_1 = require("../CustomRaidTimes");
const LocationProcessor_1 = require("../processors/LocationProcessor");
/**
 * TrainTimeAdjuster class.
 *
 * Handles the logic needed to set a new raid time.
 */
class TrainTimeAdjuster {
    ANIMATE_SEC = 97;
    MIN_WAIT_SEC = 60;
    BUFFER_SEC = 300;
    RANDOM_WAIT_MIN_SEC = 5;
    RANDOM_WAIT_MAX_SEC = 14;
    ARRIVE_RANDOM_RANGE_SEC = 300;
    BUFFER_ADJUSTMENT_MAX_PERCENT = 0.65;
    BUFFER_ADJUSTMENT_MIN_PERCENT = 0.2;
    location;
    locationName;
    constructor(location) {
        this.location = location;
        this.locationName = LocationProcessor_1.LocationProcessor.locationNames[location.Id.toString().toLowerCase()];
    }
    /**
     * Main entry point for adjusting the train times. Checks to see if the exit is a train exit, and if so, calls the
     * appropriate function to handle the logic.
     */
    adjust() {
        for (const exit of this.location.exits) {
            if (exit.PassageRequirement?.toLowerCase() === "train") {
                this.adjustTrainExit(exit);
            }
        }
    }
    /**
     * Handles the brunt of the logic for adjusting the train times.
     */
    adjustTrainExit(exit) {
        const raidTimeSec = this.location.EscapeTimeLimit * 60;
        const trainExtractWaitSec = exit.ExfiltrationTime;
        let trainWaitSec;
        let trainArriveEarliest;
        let trainArriveLatest;
        // Calculate the earliest and latest arrival times, and the train wait time.
        trainWaitSec = this.getRandomTrainWaitTime();
        [trainArriveEarliest, trainArriveLatest] = this.getInitialTrainArrivalTimes(raidTimeSec, trainExtractWaitSec, trainWaitSec);
        if (!CustomRaidTimes_1.CustomRaidTimes.config.trainSchedule.auto) {
            // Static scheduling will still have the arrival times validated and adjusted but will not be shifted to
            // earlier into the raid if there's available buffer time.
            trainArriveEarliest = CustomRaidTimes_1.CustomRaidTimes.config.trainSchedule.static.arriveEarliestMinutes * 60;
            trainArriveLatest = CustomRaidTimes_1.CustomRaidTimes.config.trainSchedule.static.arriveLatestMinutes * 60;
            trainWaitSec = CustomRaidTimes_1.CustomRaidTimes.config.trainSchedule.static.trainWaitSeconds;
            const calculatedLatestArrival = this.getLatestTrainArrivalTime(raidTimeSec, trainExtractWaitSec, trainWaitSec);
            if (trainArriveLatest > calculatedLatestArrival) {
                trainArriveLatest = calculatedLatestArrival;
            }
        }
        // Ensure the earliest arrival time is valid.
        trainArriveEarliest = this.validateEarliestArrivalTime(trainArriveEarliest);
        // Ensure the latest arrival time is valid.
        if (trainArriveLatest <= 0) {
            [trainArriveEarliest, trainArriveLatest, trainWaitSec] = this.adjustForLateTrain(trainWaitSec, raidTimeSec, trainExtractWaitSec);
            // We tried, but the train is going too be late. Warn the user.
            if (trainArriveLatest < 0) {
                CustomRaidTimes_1.CustomRaidTimes.logger.log(`CustomRaidTimes: ${this.locationName.human} Train Schedule - Train cannot depart before the end of the raid. Raid time is too short.`, "yellow");
            }
        }
        // If there is enough available time, shift the earliest arrival time to 65%-20% of the available time (a
        // minimum of 1 minute). This does not apply to static scheduling.
        if (CustomRaidTimes_1.CustomRaidTimes.config.trainSchedule.auto && trainArriveEarliest > this.BUFFER_SEC) {
            trainArriveEarliest -= this.getAdjustmentTime(trainArriveEarliest);
        }
        // Set the new train times.
        exit.MinTime = trainArriveEarliest;
        exit.MaxTime = trainArriveLatest;
        exit.Count = trainWaitSec;
        const trainArriveEarliestMin = (trainArriveEarliest / 60).toFixed(2);
        const trainArriveLatestMin = (trainArriveLatest / 60).toFixed(2);
        const trainWaitMin = (trainWaitSec / 60).toFixed(2);
        if (CustomRaidTimes_1.CustomRaidTimes.config.general.debug) {
            CustomRaidTimes_1.CustomRaidTimes.logger.log(`CustomRaidTimes: ${this.locationName.human} Train Schedule - Earliest: ${trainArriveEarliestMin} minutes, Latest: ${trainArriveLatestMin} minutes, Wait: ${trainWaitMin} minutes.`, "gray");
        }
    }
    /**
     * Calculates the initial earliest and latest train arrival times.
     */
    getInitialTrainArrivalTimes(raidTimeSec, trainExtractWaitSec, trainWaitSec) {
        const latestArrival = this.getLatestTrainArrivalTime(raidTimeSec, trainExtractWaitSec, trainWaitSec);
        let earliestArrival = latestArrival - this.ARRIVE_RANDOM_RANGE_SEC;
        if (latestArrival > 0 && earliestArrival < 0) {
            earliestArrival = 0;
        }
        return [earliestArrival, latestArrival];
    }
    /**
     * Validates that the earliest train arrival time is set to zero (arrives immediately) when it's less than zero.
     */
    validateEarliestArrivalTime(trainArriveEarliest) {
        if (trainArriveEarliest < 0) {
            trainArriveEarliest = 0;
        }
        return trainArriveEarliest;
    }
    /**
     * Lower the wait time until the latest arrival time is no longer too late.
     */
    adjustForLateTrain(trainWaitSec, raidTimeSec, trainExtractWaitSec) {
        const trainArriveEarliest = 0;
        let trainArriveLatest = 0;
        do {
            trainWaitSec--;
            trainArriveLatest = this.getLatestTrainArrivalTime(raidTimeSec, trainExtractWaitSec, trainWaitSec);
        } while (trainArriveLatest < 0 && trainWaitSec > this.MIN_WAIT_SEC);
        return [trainArriveEarliest, trainArriveLatest, trainWaitSec];
    }
    /**
     * Calculates the number of seconds the train waits before closing the doors and departing.
     * The default is random between 14 and 5 minutes.
     */
    getRandomTrainWaitTime() {
        return (60 *
            Math.floor(Math.random() * (this.RANDOM_WAIT_MAX_SEC - this.RANDOM_WAIT_MIN_SEC) + this.RANDOM_WAIT_MIN_SEC));
    }
    /**
     * Calculates the initial latest train arrival time based on other time figures.
     */
    getLatestTrainArrivalTime(raidTimeSec, trainExtractWaitSec, trainWaitSec) {
        return raidTimeSec - this.ANIMATE_SEC - trainExtractWaitSec - trainWaitSec;
    }
    /**
     * Adjust the earliest arrival time to 65%-20% of the available time; a minimum of 1 minute.
     */
    getAdjustmentTime(trainArriveEarliest) {
        const adjustmentPercentage = Number.parseFloat((Math.random() * (this.BUFFER_ADJUSTMENT_MAX_PERCENT - this.BUFFER_ADJUSTMENT_MIN_PERCENT) +
            this.BUFFER_ADJUSTMENT_MIN_PERCENT).toFixed(2));
        return Math.floor(trainArriveEarliest * adjustmentPercentage);
    }
}
exports.TrainTimeAdjuster = TrainTimeAdjuster;
//# sourceMappingURL=TrainTimeAdjuster.js.map