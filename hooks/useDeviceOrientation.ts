// 디바이스 방향 추적 훅
// Magnetometer (나침반) + DeviceMotion (기울기)

import { useState, useEffect, useRef } from 'react';
import { Magnetometer, DeviceMotion } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';

export interface DeviceOrientation {
    azimuth: number;    // 방위각 (0-360도, 북쪽 기준)
    altitude: number;   // 고도각 (-90 ~ 90도, 수평 기준)
    roll: number;       // 롤 (-180 ~ 180도)
    isAvailable: boolean;
}

export function useDeviceOrientation(updateInterval: number = 100): DeviceOrientation {
    const [orientation, setOrientation] = useState<DeviceOrientation>({
        azimuth: 0,
        altitude: 0,
        roll: 0,
        isAvailable: false
    });

    const magnetometerSub = useRef<Subscription | null>(null);
    const deviceMotionSub = useRef<Subscription | null>(null);

    const magnetometerData = useRef({ x: 0, y: 0, z: 0 });
    const deviceMotionData = useRef({ alpha: 0, beta: 0, gamma: 0 });

    useEffect(() => {
        let isMounted = true;

        async function startSensors() {
            try {
                // 자력계 센서 (방위각)
                const magAvailable = await Magnetometer.isAvailableAsync();
                if (magAvailable) {
                    Magnetometer.setUpdateInterval(updateInterval);
                    magnetometerSub.current = Magnetometer.addListener(data => {
                        magnetometerData.current = data;
                        updateOrientation();
                    });
                }

                // 디바이스 모션 센서 (기울기)
                const motionAvailable = await DeviceMotion.isAvailableAsync();
                if (motionAvailable) {
                    DeviceMotion.setUpdateInterval(updateInterval);
                    deviceMotionSub.current = DeviceMotion.addListener(data => {
                        if (data.rotation) {
                            deviceMotionData.current = {
                                alpha: data.rotation.alpha || 0,
                                beta: data.rotation.beta || 0,
                                gamma: data.rotation.gamma || 0
                            };
                            updateOrientation();
                        }
                    });
                }

                if (isMounted) {
                    setOrientation(prev => ({
                        ...prev,
                        isAvailable: magAvailable || motionAvailable
                    }));
                }
            } catch (error) {
                console.error('[useDeviceOrientation] Sensor error:', error);
            }
        }

        function updateOrientation() {
            if (!isMounted) return;

            const { x, y, z } = magnetometerData.current;
            const { beta, gamma } = deviceMotionData.current;

            // 방위각 계산 (자력계)
            let azimuth = Math.atan2(y, x) * (180 / Math.PI);
            azimuth = (azimuth + 360) % 360;

            // 고도각 계산 (beta: 앞뒤 기울기, -180 ~ 180)
            // 폰을 수직으로 들었을 때 beta ≈ 90, 하늘을 향할 때 beta ≈ 0
            let altitude = 90 - Math.abs(beta * (180 / Math.PI));
            altitude = Math.max(-90, Math.min(90, altitude));

            // 롤 계산
            const roll = gamma * (180 / Math.PI);

            setOrientation({
                azimuth,
                altitude,
                roll,
                isAvailable: true
            });
        }

        startSensors();

        return () => {
            isMounted = false;
            magnetometerSub.current?.remove();
            deviceMotionSub.current?.remove();
        };
    }, [updateInterval]);

    return orientation;
}
