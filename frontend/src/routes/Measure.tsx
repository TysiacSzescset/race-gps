import { ChangeEvent, useState } from "react";
import { useBluetooth } from "../hooks/useBluetooth.ts";
import { useMeasure } from "../hooks/useMeasure.ts";
import { GpsData, parseGpsData } from "../utils/gps.ts";
import { MeasureResult } from "../classes/measure.ts";
import { downloadFile } from "../utils/utils.ts";
import { TestSpeed } from "../components/TestSpeed.tsx";
import { Card } from "../components/Card.tsx";
import { Button } from "../components/Button.tsx";
import { Info } from "../components/Info.tsx";

export function Measure() {
  const [measureResult, setMeasureResult] = useState<MeasureResult[]>([]);
  const [gpsData, setGpsData] = useState<GpsData>({
    satellites: 0,
    alt: 0,
    time: 0,
    speed: 0,
  });
  const [csvData, setCsvData] = useState<GpsData[]>([]);

  const { speed, time, addRecord } = useMeasure({
    speedConfig: [
      [0, 60],
      [0, 100],
      [100, 150],
      [100, 200],
    ],
    onResult: (data: MeasureResult) => {
      setMeasureResult((previousMeasureResult) => [
        ...previousMeasureResult,
        data,
      ]);
    },
  });

  const { connect, disconnect, log } = useBluetooth({
    handleData: (event: Event) => {
      const data: GpsData = parseGpsData(
        (event.target as BluetoothRemoteGATTCharacteristic).value,
      );
      addRecord(data.speed, data.time);
      setGpsData(data);
      setCsvData((previousCsvData) => [...previousCsvData, data]);
    },
  });

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleDownloadCsv = () => {
    downloadFile(
      Object.keys(csvData[0]).join(",") +
        "\n" +
        csvData.map((data) => Object.values(data).join(",")).join("\n"),
      `race-gps-raw-data-${Date.now()}.csv`,
    );
  };

  const handleTestSpeed = (event: ChangeEvent<HTMLInputElement>) => {
    addRecord(parseFloat(event.target.value) || 0, Math.floor(Date.now() / 10));
  };

  // TODO: modal with graph

  return (
    <>
      <Card>
        <div className="flex flex-col justify-center items-center">
          <div className="flex justify-between w-full text-sm">
            <span className="flex gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
                />
              </svg>
              {Math.floor(gpsData.alt / 100)}m
            </span>
            <span className="flex gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
                />
              </svg>
              {gpsData.satellites}/12
            </span>
          </div>
          <span className="mt-1 text-8xl font-semibold tracking-tight text-gray-900 py-4">
            {Math.floor(speed)}
          </span>
          <div className="relative flex py-5 items-center w-full">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-gray-400">
              {String(time)
                .match(/.{1,2}/g)
                ?.join(":")}
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
          <div className="flex flex-col w-full">
            <Button onClick={handleConnect}>Connect</Button>
            <Button onClick={handleDisconnect}>Disconnect</Button>
            <Button onClick={handleDownloadCsv}>
              Download CSV ({csvData.length})
            </Button>
          </div>
        </div>
        <Info>{log}</Info>
      </Card>
      {import.meta.env.DEV ? (
        <Card>
          <TestSpeed value={speed} onChange={handleTestSpeed} />
        </Card>
      ) : null}
      {measureResult.reverse().map((measure, index) => (
        <Card key={index}>
          <div className="flex justify-between">
            <strong>
              {measure.start} - {measure.end}
            </strong>
            <span>{measure.measureTime.toFixed(2)}s</span>
          </div>
        </Card>
      ))}
    </>
  );
}
