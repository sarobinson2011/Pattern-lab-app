import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import '../../styles/ninths-module.css';

const MAX_N = 36;
const STEP_ANGLE = (Math.PI * 2) / 9;

type ViewMode = 'stack' | 'dial';

function getNinthsDecimal(n: number): string {
    if (n === 0) return '0';
    if (n % 9 === 0) return String(n / 9);

    const whole = Math.floor(n / 9);
    const digit = n % 9;

    return `${whole}.${String(digit).repeat(6)}...`;
}

function getWholeLabel(wholes: number, remainder: number): string {
    if (wholes === 0) {
        return `${remainder} ninth${remainder === 1 ? '' : 's'}`;
    }

    if (remainder === 0) {
        return `${wholes} whole${wholes === 1 ? '' : 's'}`;
    }

    return `${wholes} whole${wholes === 1 ? '' : 's'} and ${remainder} ninth${remainder === 1 ? '' : 's'
        }`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalizeAngleDelta(delta: number): number {
    if (delta > Math.PI) return delta - Math.PI * 2;
    if (delta < -Math.PI) return delta + Math.PI * 2;
    return delta;
}

function getPointerAngle(
    event: ReactPointerEvent<HTMLDivElement>,
    element: HTMLDivElement,
): number {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;

    return Math.atan2(dy, dx);
}

function getDisplayedNinth(n: number): number {
    if (n === 0) return 0;
    const remainder = n % 9;
    return remainder === 0 ? 9 : remainder;
}

function getDialRotation(n: number): number {
    if (n === 0) return 0;
    const displayedNinth = getDisplayedNinth(n);
    return ((displayedNinth - 1) / 9) * 360;
}

type RowData = {
    key: string;
    level: number;
    filledCount: number;
    isComplete: boolean;
    isActive: boolean;
};

function buildRows(n: number, wholePart: number, remainder: number): RowData[] {
    if (n === 0) {
        return [
            {
                key: 'row-0',
                level: 0,
                filledCount: 0,
                isComplete: false,
                isActive: true,
            },
        ];
    }

    const builtRows: RowData[] = [];

    for (let level = 0; level < wholePart; level += 1) {
        builtRows.push({
            key: `row-complete-${level}`,
            level,
            filledCount: 9,
            isComplete: true,
            isActive: false,
        });
    }

    if (remainder > 0) {
        builtRows.push({
            key: `row-active-${wholePart}`,
            level: wholePart,
            filledCount: remainder,
            isComplete: false,
            isActive: true,
        });
    } else {
        builtRows.push({
            key: `row-complete-edge-${wholePart - 1}`,
            level: Math.max(wholePart - 1, 0),
            filledCount: 9,
            isComplete: true,
            isActive: true,
        });
    }

    return builtRows;
}

function StackView({ rows }: { rows: RowData[] }) {
    return (
        <div className="ninths-module__stack">
            {rows.map((row, rowIndex) => {
                const paletteClass = `ninths-module__row--palette-${row.level % 4}`;

                return (
                    <div
                        key={row.key}
                        className={[
                            'ninths-module__row',
                            paletteClass,
                            row.isComplete ? 'ninths-module__row--complete' : '',
                            row.isActive ? 'ninths-module__row--active' : '',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                    >
                        <div className="ninths-module__row-meta">
                            <span className="ninths-module__row-title">Whole {rowIndex + 1}</span>
                            <span className="ninths-module__row-status">{row.filledCount}/9 parts</span>
                        </div>

                        <div className="ninths-module__row-grid">
                            {Array.from({ length: 9 }, (_, index) => {
                                const isFilled = index < row.filledCount;

                                return (
                                    <div
                                        key={`${row.key}-segment-${index}`}
                                        className={[
                                            'ninths-module__segment',
                                            isFilled ? 'ninths-module__segment--filled' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                    >
                                        <span className="ninths-module__segment-number">{index + 1}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DialView({
    n,
    setN,
    wholePart,
    decimalValue,
    mixedLabel,
    carryPulse,
}: {
    n: number;
    setN: React.Dispatch<React.SetStateAction<number>>;
    wholePart: number;
    decimalValue: string;
    mixedLabel: string;
    carryPulse: number;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const dialRef = useRef<HTMLDivElement | null>(null);
    const lastAngleRef = useRef<number | null>(null);
    const dragValueRef = useRef<number>(n);

    const displayedNinth = getDisplayedNinth(n);
    const rotation = getDialRotation(n);
    const isCarryState = n > 0 && displayedNinth === 9;

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!dialRef.current) return;

        const angle = getPointerAngle(event, dialRef.current);
        lastAngleRef.current = angle;
        dragValueRef.current = n;
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDragging || !dialRef.current || lastAngleRef.current === null) return;

        const angle = getPointerAngle(event, dialRef.current);
        const delta = normalizeAngleDelta(angle - lastAngleRef.current);

        dragValueRef.current = clamp(dragValueRef.current + delta / STEP_ANGLE, 0, MAX_N);
        lastAngleRef.current = angle;

        setN(Math.round(dragValueRef.current));
    };

    const endDrag = () => {
        setIsDragging(false);
        lastAngleRef.current = null;
    };

    return (
        <div className="ninths-module__dial-instrument">
            <div
                className={[
                    'ninths-module__dial-top-readout',
                    carryPulse > 0 ? 'ninths-module__dial-top-readout--carry' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                <span className="ninths-module__dial-top-label">Whole</span>
                <strong className="ninths-module__dial-top-value">{wholePart}</strong>
            </div>

            <div className="ninths-module__dial-wrap">
                <div
                    ref={dialRef}
                    className={[
                        'ninths-module__dial',
                        isDragging ? 'ninths-module__dial--dragging' : '',
                        isCarryState ? 'ninths-module__dial--carry-state' : '',
                        carryPulse > 0 ? 'ninths-module__dial--carry-pulse' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerLeave={endDrag}
                >
                    <div className="ninths-module__dial-top-marker" />
                    {carryPulse > 0 && <div className="ninths-module__dial-burst-ring" />}
                    {carryPulse > 0 && <div className="ninths-module__dial-burst-core" />}

                    {Array.from({ length: 9 }, (_, i) => {
                        const value = i + 1;
                        const angle = (value - 1) * 40;
                        return (
                            <div
                                key={`tick-${value}`}
                                className={[
                                    'ninths-module__tick',
                                    value === 9 ? 'ninths-module__tick--major' : '',
                                ].join(' ')}
                                style={{ '--angle': `${angle}deg` } as CSSProperties}
                            />
                        );
                    })}

                    {Array.from({ length: 9 }, (_, i) => {
                        const value = i + 1;
                        const angle = (value - 1) * 40;
                        const isActive = displayedNinth === value;

                        return (
                            <div
                                key={`label-${value}`}
                                className={[
                                    'ninths-module__dial-label',
                                    isActive ? 'ninths-module__dial-label--active' : '',
                                    value === 9 ? 'ninths-module__dial-label--nine' : '',
                                ].join(' ')}
                                style={{ '--angle': `${angle}deg` } as CSSProperties}
                            >
                                {value}
                            </div>
                        );
                    })}

                    <div
                        className="ninths-module__dial-rotor"
                        style={{ transform: `rotate(${rotation}deg)` }}
                    >
                        <div className="ninths-module__dial-hand" />
                    </div>

                    <div className="ninths-module__dial-centre">
                        <span className="ninths-module__dial-centre-label">Ninth</span>
                        <strong className="ninths-module__dial-centre-value">{displayedNinth}</strong>
                    </div>
                </div>
            </div>

            <div className="ninths-module__dial-readout-cluster">
                <div
                    className={[
                        'ninths-module__dial-decimal',
                        carryPulse > 0 ? 'ninths-module__dial-decimal--carry' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                >
                    <span className="ninths-module__dial-decimal-label">Decimal</span>
                    <strong className="ninths-module__dial-decimal-value">{decimalValue}</strong>
                </div>

                <p className="ninths-module__dial-structure">{mixedLabel}</p>
                <p className="ninths-module__dial-fraction">{n} / 9</p>
            </div>
        </div>
    );
}

export default function NinthsModule() {
    const [n, setN] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('stack');
    const [carryPulse, setCarryPulse] = useState(0);
    const previousNRef = useRef(n);

    const decimalValue = useMemo(() => getNinthsDecimal(n), [n]);

    const wholePart = Math.floor(n / 9);
    const remainder = n % 9;
    const mixedLabel = getWholeLabel(wholePart, remainder);

    const rows = useMemo(() => buildRows(n, wholePart, remainder), [n, wholePart, remainder]);

    useEffect(() => {
        const previousN = previousNRef.current;
        const movedForwardIntoWhole = n > 0 && n > previousN && n % 9 === 0;
        const movedBackwardIntoWhole = n > 0 && n < previousN && n % 9 === 0;

        if (movedForwardIntoWhole || movedBackwardIntoWhole) {
            setCarryPulse((value) => value + 1);
        }

        previousNRef.current = n;
    }, [n]);

    useEffect(() => {
        if (carryPulse === 0) return;

        const timer = window.setTimeout(() => {
            setCarryPulse(0);
        }, 840);

        return () => window.clearTimeout(timer);
    }, [carryPulse]);

    return (
        <section className="ninths-module">
            <div className="ninths-module__intro">
                <p className="ninths-module__label">Module 01</p>
                <h2 className="ninths-module__title">The secret of ninths</h2>
                <p className="ninths-module__text">
                    Move through ninths and watch how repeated cycles turn into whole numbers.
                </p>
            </div>

            {viewMode === 'stack' ? (
                <>
                    <div className="ninths-module__control">
                        <label htmlFor="n-slider" className="ninths-module__control-label">
                            Choose a number: <strong>{n}</strong>
                        </label>

                        <input
                            id="n-slider"
                            className="ninths-module__slider"
                            type="range"
                            min="0"
                            max={MAX_N}
                            step="1"
                            value={n}
                            onChange={(event) => setN(Number(event.target.value))}
                        />

                        <div className="ninths-module__ticks">
                            <span>0</span>
                            <span>9</span>
                            <span>18</span>
                            <span>27</span>
                            <span>36</span>
                        </div>
                    </div>

                    <div className="ninths-module__panel">
                        <div className="ninths-module__card">
                            <span className="ninths-module__card-label">Fraction</span>
                            <strong className="ninths-module__value">{n} / 9</strong>
                        </div>

                        <div className="ninths-module__card">
                            <span className="ninths-module__card-label">Decimal</span>
                            <strong className="ninths-module__value">{decimalValue}</strong>
                        </div>

                        <div className="ninths-module__card">
                            <span className="ninths-module__card-label">Structure</span>
                            <strong className="ninths-module__value">{mixedLabel}</strong>
                        </div>
                    </div>
                </>
            ) : null}

            <div className="ninths-module__mode-switch">
                <button
                    type="button"
                    className={[
                        'ninths-module__mode-button',
                        viewMode === 'stack' ? 'ninths-module__mode-button--active' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onClick={() => setViewMode('stack')}
                >
                    Stacked wholes
                </button>

                <button
                    type="button"
                    className={[
                        'ninths-module__mode-button',
                        viewMode === 'dial' ? 'ninths-module__mode-button--active' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    onClick={() => setViewMode('dial')}
                >
                    Dial cycle
                </button>
            </div>

            <div className="ninths-module__visual-card">
                {viewMode === 'stack' && (
                    <div className="ninths-module__visual-header">
                        <div>
                            <p className="ninths-module__visual-label">Stacked pattern</p>
                            <h3 className="ninths-module__visual-title">Wholes built from ninths</h3>
                        </div>

                        <p className="ninths-module__visual-text">
                            Each horizontal row is one whole. Filled rows show completed wholes.
                        </p>
                    </div>
                )}

                {viewMode === 'stack' ? (
                    <StackView rows={rows} />
                ) : (
                    <DialView
                        n={n}
                        setN={setN}
                        wholePart={wholePart}
                        decimalValue={decimalValue}
                        mixedLabel={mixedLabel}
                        carryPulse={carryPulse}
                    />
                )}

                {viewMode === 'stack' && (
                    <p className="ninths-module__rollover">
                        {n === 0
                            ? 'Start at zero. No whole has formed yet.'
                            : remainder === 0
                                ? `${n}/9 lands exactly on a whole number, so the cycle completes cleanly.`
                                : `You have ${wholePart} complete whole${wholePart === 1 ? '' : 's'
                                } and ${remainder} extra ninth${remainder === 1 ? '' : 's'}, so the next whole is still forming.`}
                    </p>
                )}
            </div>
        </section>
    );
}
