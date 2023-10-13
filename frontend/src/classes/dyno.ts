enum DynoRecordStatus {
  Power = "power",
  Loss = "loss",
}

interface DynoRecord {
  speed: number;
  time: number;
  alt?: number;
  satellites?: number;
  increment: boolean;
  decrement: boolean;
  status?: DynoRecordStatus;
  weight: number;
  speedMs: number;
  engineSpeed: number;
  measureTime: number;
  ek: number;
  powerKw: number;
  powerKm: number;
  torque: number;
  lossKm: number;
  powerKmWithLoss: number;
  torqueWithLoss: number;
  powerKmAvg: number;
  torqueAvg: number;
}

export class Dyno {
  private records: DynoRecord[] = [];
  private powerRecords: number = 0;
  private powerStarted: boolean = false;
  private powerEnded: boolean = false;
  private lossRecords: number = 0;
  private lossStarted: boolean = false;
  private lossEnded: boolean = false;
  private weight: number = 0;
  private speedOn3000rpm: number = 0;
  private cx: number = 0;
  private frontalSurface: number = 0;
  private testWheelLoss: number = 0;
  private airDensity: number = 0;

  public constructor(private minimumRecordsToMeasure: number = 20) {}

  public setConfig(
    weight: number,
    speedOn3000rpm: number,
    cx: number,
    frontalSurface: number,
    testWheelLoss: number,
    airDensity: number,
  ) {
    this.weight = weight;
    this.speedOn3000rpm = speedOn3000rpm;
    this.cx = cx;
    this.frontalSurface = frontalSurface;
    this.testWheelLoss = testWheelLoss;
    this.airDensity = airDensity;
  }

  public addRecord(
    speed: number,
    time: number,
    alt?: number,
    satellites?: number,
  ): void {
    const previousRecord = this.records[this.records.length - 1];
    const engineSpeed = (speed * 3000) / this.speedOn3000rpm;
    const weight = this.weight;
    const speedMs = speed * 0.277777778;
    const ek = (weight * Math.pow(speedMs, 2)) / 2;
    const measureTime = (time - (previousRecord?.time || 0)) / 100;
    const i = (ek - previousRecord?.ek) / measureTime;
    const powerKw = i / 1000;
    const powerKm = powerKw / 0.73549875;
    const torque = (9549.3 * previousRecord?.powerKw) / engineSpeed;

    const wheelLossValue = this.testWheelLoss * Math.pow(speed, 2);
    const airDensity = this.airDensity;
    const cx = this.cx;
    const surface = this.frontalSurface;
    const airLoss =
      0.0005 * cx * surface * airDensity * Math.pow(speedMs, 3) * 1.359;

    const powerKmWithLoss = powerKm + wheelLossValue + airLoss;
    const torqueWithLoss = (9549.3 * powerKmWithLoss) / 1.36 / engineSpeed;

    this.records.push({
      speed,
      time,
      alt,
      satellites,
      increment: Math.floor(previousRecord?.speed) <= Math.floor(speed),
      decrement: Math.floor(previousRecord?.speed) >= Math.floor(speed),
      status: undefined,
      weight,
      speedMs,
      engineSpeed,
      measureTime,
      ek,
      powerKw,
      powerKm,
      torque,
      lossKm: wheelLossValue + airLoss,
      powerKmWithLoss,
      torqueWithLoss,
      powerKmAvg: 0,
      torqueAvg: 0,
    });

    this.parseRecords();
  }

  public getPowerRecords(): DynoRecord[] {
    return this.records
      .map((record, index) => {
        const avg = 3;
        let sumAvg = 0;

        for (let i = -avg; i <= avg; i++) {
          sumAvg += this.records[index - i]?.powerKmWithLoss;
        }

        return {
          ...record,
          powerKmAvg: sumAvg / (avg * 2 + 1),
        };
      })
      .map((record, index) => {
        const avg = 3;
        let sumAvg = 0;

        for (let i = -avg; i <= avg; i++) {
          sumAvg += this.records[index - i]?.torqueWithLoss;
        }

        return {
          ...record,
          torqueAvg: sumAvg / (avg * 2 + 1),
        };
      })
      .filter((record) => record.status === DynoRecordStatus.Power);
  }

  public getLossRecords(): DynoRecord[] {
    return this.records.filter(
      (record) => record.status === DynoRecordStatus.Loss,
    );
  }

  public reset() {
    this.records = [];
    this.powerRecords = 0;
    this.powerStarted = false;
    this.powerEnded = false;
    this.lossRecords = 0;
    this.lossStarted = false;
    this.lossEnded = false;
  }

  private parsePowerRecords(): void {
    const previousRecord = this.records[this.records.length - 2];
    const actualRecord = this.records[this.records.length - 1];

    if (previousRecord?.increment) {
      this.powerRecords++;
      this.lossRecords = 0;
    } else {
      this.powerRecords = 0;
    }

    if (!this.powerEnded && this.powerRecords >= this.minimumRecordsToMeasure) {
      this.powerStarted = true;
      actualRecord.status = DynoRecordStatus.Power;

      for (let i = 0; i <= this.powerRecords; i++) {
        this.records[this.records.length - 1 - i].status =
          DynoRecordStatus.Power;
      }
    }

    if (this.powerStarted && this.powerRecords < this.minimumRecordsToMeasure) {
      this.powerEnded = true;
    }
  }

  private parseLossRecords(): void {
    const previousRecord = this.records[this.records.length - 2];
    const actualRecord = this.records[this.records.length - 1];

    if (previousRecord?.decrement) {
      this.lossRecords++;
    } else {
      this.lossRecords = 0;
    }

    if (!this.lossEnded && this.lossRecords >= this.minimumRecordsToMeasure) {
      this.lossStarted = true;
      actualRecord.status = DynoRecordStatus.Loss;

      for (let i = 0; i < this.lossRecords; i++) {
        this.records[this.records.length - i - 1].status =
          DynoRecordStatus.Loss;
      }
    }

    if (this.lossStarted && this.lossRecords < this.minimumRecordsToMeasure) {
      this.lossEnded = true;
    }
  }

  private parseRecords(): void {
    if (!this.powerStarted || !this.powerEnded) {
      this.parsePowerRecords();
    }

    if (this.powerStarted && this.powerEnded) {
      this.parseLossRecords();
    }
  }
}
