import React, { useState, useMemo, useEffect } from "react";
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Calendar, 
  ArrowRight, 
  Database, 
  Sliders, 
  RotateCcw, 
  DollarSign, 
  Gauge, 
  TrendingDown,
  Info
} from "lucide-react";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from "recharts";

interface CostForecastingViewProps {
  expenditures: any[];
  donations: any[];
  projectConfig: any;
  physicalProgressPercent?: number;
}

const localFormatCurrency = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);
};

export default function CostForecastingView({ 
  expenditures, 
  donations, 
  projectConfig,
  physicalProgressPercent = 0
}: CostForecastingViewProps) {
  
  // Clean default data
  const targetBudget = useMemo(() => {
    return Number(projectConfig?.budget || 250000000); // fallback default to 250 million if not set
  }, [projectConfig]);

  const physicalProgress = useMemo(() => {
    return Math.max(0, Math.min(100, physicalProgressPercent));
  }, [physicalProgressPercent]);

  // Total spent calculation
  const totalSpent = useMemo(() => {
    return expenditures.reduce((sum, e) => sum + (e.totalPrice || 0), 0);
  }, [expenditures]);

  // Aggregate expenditures by month index
  const monthlyData = useMemo(() => {
    const monthsMap: Record<string, { expenditures: number; dateVal: Date }> = {};
    
    // Default start date is project configuration initializedAt, or 6 months ago
    let startDate = projectConfig?.initializedAt ? new Date(projectConfig.initializedAt) : null;
    if (!startDate || isNaN(startDate.getTime())) {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 5); // fallback default 6 months ago
    }

    // Capture expenditures
    expenditures.forEach((e) => {
      const date = new Date(e.date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      if (!monthsMap[key]) {
        monthsMap[key] = { expenditures: 0, dateVal: new Date(year, monthIndex, 1) };
      }
      monthsMap[key].expenditures += (e.totalPrice || 0);
    });

    const indonesianMonths = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", 
      "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
    ];

    const sortedKeys = Object.keys(monthsMap).sort();
    
    // Ensure we have at least any historical dataset from start date to current month
    const currentDate = new Date();
    let tempDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const limitDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    
    while (tempDate < limitDate) {
      const key = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthsMap[key]) {
        monthsMap[key] = { expenditures: 0, dateVal: new Date(tempDate) };
      }
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    return Object.keys(monthsMap)
      .sort()
      .map((key) => {
        const item = monthsMap[key];
        return {
          key,
          year: item.dateVal.getFullYear(),
          monthIdx: item.dateVal.getMonth(),
          monthName: indonesianMonths[item.dateVal.getMonth()],
          yearShort: item.dateVal.getFullYear().toString().substring(2),
          expenditures: item.expenditures,
        };
      });
  }, [expenditures, projectConfig]);

  // Calculate historical monthly run-rate
  const averageMonthlySpend = useMemo(() => {
    // Average over months with positive expenditures, or total active months
    const activeMonths = monthlyData.filter(m => m.expenditures > 0).length || 1;
    return totalSpent / activeMonths;
  }, [monthlyData, totalSpent]);

  // Estimate remaining months based on past rate of physical progress
  const autoRemainingMonths = useMemo(() => {
    if (physicalProgress >= 100) return 0;
    if (physicalProgress <= 0) return 6; // default fallback if no progress

    // Find chronological index of months from initialized date
    const elapsedMonths = Math.max(1, monthlyData.length);
    // Rate of physical progress per month
    const progressPerMonth = physicalProgress / elapsedMonths;
    const remainingProgress = 100 - physicalProgress;
    
    // Estimated remaining months
    return Math.max(1, Math.ceil(remainingProgress / progressPerMonth));
  }, [physicalProgress, monthlyData]);

  // User interactive state overrides for simulations
  const [modelType, setModelType] = useState<"evm" | "linear">("linear");
  const [remainingMonthsInput, setRemainingMonthsInput] = useState<number>(6);
  const [customMonthlySpend, setCustomMonthlySpend] = useState<number>(0);
  const [isSimulationActive, setIsSimulationActive] = useState(false);

  // Auto align simulation state once initial DB state resolves
  useEffect(() => {
    if (!isSimulationActive) {
      setRemainingMonthsInput(autoRemainingMonths);
      setCustomMonthlySpend(Math.round(averageMonthlySpend || 15000000));
    }
  }, [autoRemainingMonths, averageMonthlySpend, isSimulationActive]);

  // Reset to auto defaults
  const handleResetSimulation = () => {
    setRemainingMonthsInput(autoRemainingMonths);
    setCustomMonthlySpend(Math.round(averageMonthlySpend || 15000000));
    setIsSimulationActive(false);
  };

  // EVM (Earned Value Management) Calculations
  // Earned Value (EV) = Target Budget * Physical Progress
  const earnedValue = useMemo(() => {
    return targetBudget * (physicalProgress / 100);
  }, [targetBudget, physicalProgress]);

  // Cost Performance Index (CPI) = EV / Actual Cost (AC)
  const cpi = useMemo(() => {
    if (totalSpent <= 0) return 1.0;
    return earnedValue / totalSpent;
  }, [earnedValue, totalSpent]);

  // Estimate at Completion (EAC) based on standard EVM
  const evmEac = useMemo(() => {
    if (physicalProgress <= 0) return targetBudget;
    if (cpi <= 0) return totalSpent + (targetBudget - earnedValue);
    return targetBudget / cpi;
  }, [targetBudget, physicalProgress, cpi, totalSpent, earnedValue]);

  // Run Rate based estimations (Linear Model)
  const linearEac = useMemo(() => {
    const projectedRemainingCost = customMonthlySpend * remainingMonthsInput;
    return totalSpent + projectedRemainingCost;
  }, [totalSpent, customMonthlySpend, remainingMonthsInput]);

  // Selected Model Estimates
  const selectedEac = useMemo(() => {
    return modelType === "evm" ? evmEac : linearEac;
  }, [modelType, evmEac, linearEac]);

  const projectedRemainingCost = useMemo(() => {
    if (modelType === "evm") {
      return evmEac > totalSpent ? evmEac - totalSpent : 0;
    }
    return customMonthlySpend * remainingMonthsInput;
  }, [modelType, evmEac, totalSpent, customMonthlySpend, remainingMonthsInput]);

  const overUnderAmount = useMemo(() => {
    return targetBudget - selectedEac;
  }, [targetBudget, selectedEac]);

  const isWithinBudget = overUnderAmount >= 0;

  // Chart data computation (combining past and future months)
  const fullChartData = useMemo(() => {
    const chartList: any[] = [];
    let cumHistorical = 0;

    // Push historical
    monthlyData.forEach((m) => {
      cumHistorical += m.expenditures;
      chartList.push({
        label: `${m.monthName} '${m.yearShort}`,
        historical: cumHistorical,
        projected: cumHistorical,
        budget: targetBudget,
        type: 'historical'
      });
    });

    // Determine how many months to project
    const projectionCount = modelType === "evm" 
      ? Math.max(1, Math.min(24, Math.ceil((evmEac - totalSpent) / (averageMonthlySpend || 10000000))))
      : remainingMonthsInput;

    let cumProjected = cumHistorical;
    const lastMonthObj = monthlyData[monthlyData.length - 1];
    let projYear = lastMonthObj ? lastMonthObj.year : new Date().getFullYear();
    let projMonthIdx = lastMonthObj ? lastMonthObj.monthIdx : new Date().getMonth();

    const indonesianMonths = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", 
      "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
    ];

    const monthlyProjectedIncrement = modelType === "evm" 
      ? (averageMonthlySpend || 15000000) 
      : customMonthlySpend;

    for (let i = 1; i <= projectionCount; i++) {
      projMonthIdx += 1;
      if (projMonthIdx > 11) {
        projMonthIdx = 0;
        projYear += 1;
      }
      cumProjected += monthlyProjectedIncrement;

      chartList.push({
        label: `${indonesianMonths[projMonthIdx]} '${projYear.toString().substring(2)} (Proj)`,
        historical: null,
        projected: Math.round(cumProjected),
        budget: targetBudget,
        type: 'projected'
      });
    }

    return chartList;
  }, [monthlyData, targetBudget, modelType, evmEac, totalSpent, averageMonthlySpend, customMonthlySpend, remainingMonthsInput]);

  return (
    <div id="cost-forecasting-container" className="space-y-6">
      
      {/* HEADER CARDS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-100/50 px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1.5 w-max">
              <TrendingUp className="h-3 w-3 text-emerald-600 shrink-0" />
              Sistem Prediksi Akuntabilitas Kas
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight mt-1.5">
              Prakiraan Biaya Konstruksi & Alokasi RAB
            </h3>
            <p className="text-xxs sm:text-xs text-slate-400 mt-0.5">
              Prediksi kecukupan anggaran pembangunan berbasis real-time run rate pengeluaran dan akuntansi EVM modern.
            </p>
          </div>

          <div className="bg-slate-100/80 p-1 rounded-lg flex items-center gap-1 self-start sm:self-auto shrink-0 border border-slate-200/30">
            <button
              type="button"
              onClick={() => setModelType("linear")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-100 cursor-pointer ${
                modelType === "linear" 
                  ? "bg-white text-emerald-700 shadow-3xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Model Run Rate
            </button>
            <button
              type="button"
              onClick={() => setModelType("evm")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-100 cursor-pointer ${
                modelType === "evm" 
                  ? "bg-white text-emerald-700 shadow-3xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Model EVM
            </button>
          </div>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* CARD 1: BUDGET TARGET */}
        <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 truncate">Anggaran Target (RAB)</p>
                <h4 className="text-xs sm:text-sm md:text-base xl:text-lg font-black text-slate-805 font-mono truncate" title={localFormatCurrency(targetBudget)}>
                  {localFormatCurrency(targetBudget)}
                </h4>
              </div>
              <div className="p-1 sm:p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-650 shrink-0">
                <Database className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
          </div>
          <div className="mt-2.5 sm:mt-4 space-y-1 bg-slate-50/50 p-1.5 sm:p-2 rounded-lg border border-slate-100">
            <div className="flex justify-between items-center text-[8px] sm:text-[10px] text-slate-550 gap-1">
              <span className="font-medium truncate">Status Batas Anggaran:</span>
              <span className="font-semibold text-slate-700 shrink-0">100% Plafon Atas</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1 sm:h-1.5 overflow-hidden">
              <div className="bg-slate-400 h-1 sm:h-1.5 rounded-full w-full"></div>
            </div>
            <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-slate-405 pt-0.5 sm:pt-1 gap-1">
              <span className="truncate">Mulai Proyek:</span>
              <span className="font-mono font-semibold text-slate-600 shrink-0 truncate">
                {projectConfig?.initializedAt ? new Date(projectConfig.initializedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: REALISASI SEKARANG */}
        <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 truncate">Realisasi Pengeluaran</p>
                <h4 className="text-xs sm:text-sm md:text-base xl:text-lg font-black text-rose-600 font-mono truncate" title={localFormatCurrency(totalSpent)}>
                  {localFormatCurrency(totalSpent)}
                </h4>
              </div>
              <div className="p-1 sm:p-2 bg-rose-50 border border-rose-100 rounded-lg text-rose-500 shrink-0">
                <TrendingDown className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
          </div>
          <div className="mt-2.5 sm:mt-4 space-y-1 bg-slate-50/50 p-1.5 sm:p-2 rounded-lg border border-slate-100">
            <div className="flex justify-between items-center text-[8px] sm:text-[10px] text-slate-550 gap-1">
              <span className="font-medium truncate">Porsi Terpakai:</span>
              <span className="font-mono font-bold text-rose-600 shrink-0">
                {((totalSpent / targetBudget) * 100).toFixed(1)}% terpakai
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1 sm:h-1.5 overflow-hidden">
              <div 
                className="bg-rose-500 h-1 sm:h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, (totalSpent / targetBudget) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-slate-405 pt-0.5 sm:pt-1 gap-1">
              <span className="truncate">Sisa Batas Anggaran:</span>
              <span className="font-mono font-semibold text-slate-600 shrink-0 truncate">
                {localFormatCurrency(Math.max(0, targetBudget - totalSpent))}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: ESTIMASI AKHIR */}
        <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 truncate">Prakiraan Biaya Akhir (EAC)</p>
                <h4 className="text-xs sm:text-sm md:text-base xl:text-lg font-black text-slate-805 font-mono truncate" title={localFormatCurrency(selectedEac)}>
                  {localFormatCurrency(selectedEac)}
                </h4>
              </div>
              <div className="p-1 sm:p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-650 shrink-0">
                <Gauge className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
              </div>
            </div>
          </div>
          <div className="mt-2.5 sm:mt-4 space-y-1 bg-slate-50/50 p-1.5 sm:p-2 rounded-lg border border-slate-100">
            <div className="flex justify-between items-center text-[8px] sm:text-[10px] text-slate-550 gap-1">
              <span className="font-medium truncate">Tambahan Sisa Kerja:</span>
              <span className="font-mono font-bold text-slate-700 shrink-0 truncate">
                {localFormatCurrency(projectedRemainingCost)}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1 sm:h-1.5 overflow-hidden">
              <div 
                className={`h-1 sm:h-1.5 rounded-full ${isWithinBudget ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, (selectedEac / targetBudget) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-slate-405 pt-0.5 sm:pt-1 gap-1">
              <span className="truncate">Prakiraan Rasio EAC/RAB:</span>
              <span className="font-mono font-semibold text-slate-600 shrink-0 truncate">
                {((selectedEac / targetBudget) * 100).toFixed(1)}% {selectedEac > targetBudget ? "(Ekses)" : "(Aman)"}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4: OVER / UNDER FORECAST */}
        <div className={`p-3 sm:p-4 lg:p-5 rounded-2xl border shadow-2xs transition-all duration-300 flex flex-col justify-between ${
          isWithinBudget 
            ? "bg-emerald-50/40 border-emerald-200 text-emerald-900" 
            : "bg-rose-50/40 border-rose-200 text-rose-900"
        }`}>
          <div>
            <div className="flex justify-between items-start gap-1">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-75 truncate">Prediksi Hasil Akhir</p>
                <h4 className={`text-xs sm:text-sm md:text-base xl:text-lg font-black font-mono truncate ${
                  isWithinBudget ? "text-emerald-700" : "text-rose-700"
                }`} title={(isWithinBudget ? "+" : "") + localFormatCurrency(overUnderAmount)}>
                  {isWithinBudget ? "+" : ""}{localFormatCurrency(overUnderAmount)}
                </h4>
              </div>
              <div className={`p-1 sm:p-2 rounded-lg border shrink-0 ${
                isWithinBudget 
                  ? "bg-emerald-100 border-emerald-205 text-emerald-700" 
                  : "bg-rose-100 border-rose-205 text-rose-700"
              }`}>
                {isWithinBudget ? (
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
                )}
              </div>
            </div>
          </div>
          <div className={`mt-2.5 sm:mt-4 space-y-1 p-1.5 sm:p-2 rounded-lg border ${
            isWithinBudget 
              ? "bg-white/80 border-emerald-100" 
              : "bg-white/80 border-rose-100"
          }`}>
            <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-semibold text-slate-600 gap-1">
              <span className="truncate">Prediksi Kas:</span>
              <span className={`shrink-0 ${isWithinBudget ? "text-emerald-700" : "text-rose-700"}`}>
                {isWithinBudget ? "Surplus Hemat" : "Defisit Minim"}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1 sm:h-1.5 overflow-hidden">
              <div 
                className={`h-1 sm:h-1.5 rounded-full ${isWithinBudget ? "bg-emerald-500" : "bg-rose-500"}`}
                style={{ width: `${Math.max(10, Math.min(100, Math.abs(overUnderAmount) / targetBudget * 100))}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-slate-500 pt-0.5 sm:pt-1 gap-1">
              <span className="truncate">Status Rencana:</span>
              <span className="font-semibold text-slate-700 shrink-0 truncate">
                {isWithinBudget ? "Model Stabil" : "Butuh Evaluasi"}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* CORE SPLIT GRID: SIMULATOR & RECHARTS GRAPH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SIMULATOR PANEL */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-emerald-600" />
              Simulasi Pengendalian Biaya
            </h4>
            {isSimulationActive && (
              <button
                onClick={handleResetSimulation}
                className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[10px] bg-slate-100 px-2 py-1 rounded font-semibold transition"
                title="Pulihkan data riil proyek dari database"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          <div className="space-y-4 text-xxs font-sans">
            <div>
              <p className="font-bold text-slate-650 mb-1">Model Prediksi Aktif</p>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setModelType("linear");
                    setIsSimulationActive(true);
                  }}
                  className={`py-1.5 text-center font-semibold rounded ${
                    modelType === 'linear' ? 'bg-white shadow-3xs text-emerald-800' : 'text-slate-500 hover:bg-slate-100/50'
                  }`}
                >
                  Tren Manual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModelType("evm");
                    setIsSimulationActive(true);
                  }}
                  className={`py-1.5 text-center font-semibold rounded ${
                    modelType === 'evm' ? 'bg-white shadow-3xs text-emerald-800' : 'text-slate-500 hover:bg-slate-100/50'
                  }`}
                >
                  Earned Value
                </button>
              </div>
            </div>

            {modelType === "linear" ? (
              <>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-600">Sisa Durasi Konstruksi</span>
                    <span className="font-bold text-slate-800 font-mono">{remainingMonthsInput} Bulan</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={remainingMonthsInput}
                    onChange={(e) => {
                      setRemainingMonthsInput(Number(e.target.value));
                      setIsSimulationActive(true);
                    }}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                    <span>Otomatis: {autoRemainingMonths} bulan</span>
                    <span>Max: 24 bulan</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-600">Proyeksi Anggaran Bulanan</span>
                    <span className="font-bold text-slate-800 font-mono">{localFormatCurrency(customMonthlySpend)} / bln</span>
                  </div>
                  <input
                    type="range"
                    min={Math.max(1000000, Math.round(averageMonthlySpend * 0.2))}
                    max={Math.max(100000000, Math.round(averageMonthlySpend * 2.5))}
                    step="1000000"
                    value={customMonthlySpend}
                    onChange={(e) => {
                      setCustomMonthlySpend(Number(e.target.value));
                      setIsSimulationActive(true);
                    }}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                    <span>Rata-rata Riil: {localFormatCurrency(averageMonthlySpend)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5 text-slate-700">
                <div>
                  <h5 className="font-bold text-slate-800 text-[10px] mb-1">Metrik Analisis Earned Value (EVM)</h5>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Model ini secara objektif mencocokkan total realisasi biaya dengan tingkat kemajuan fisik yang dikirim manajer lapangan yaitu <span className="font-bold text-slate-800">{physicalProgress}%</span>.
                  </p>
                </div>
                
                <div className="border-t border-slate-200/60 pt-3 grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="block text-[8px] text-slate-400 uppercase">Earned Value (EV)</span>
                    <span className="text-[10.5px] font-bold text-slate-700">{localFormatCurrency(earnedValue)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-400 uppercase">Cost Index (CPI)</span>
                    <span className={`text-[10.5px] font-bold ${cpi >= 1 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {cpi.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-205/50 p-2.5 rounded border border-slate-200 text-[9.5px] text-slate-600 flex items-start gap-1.5 leading-relaxed">
                  <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    {cpi >= 1 
                      ? "Setiap IDR 1.000 pengeluaran menghasilkan nilai fisik di atas IDR 1.000 (EFISIEN)." 
                      : "Setiap IDR 1.000 yang keluar bernilai fisik kurang dari IDR 1.000 (INEFISIEN)."}
                  </span>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3 mt-3">
              <div className="text-[9.5px] text-slate-550 space-y-2 leading-relaxed">
                <span className="font-bold text-slate-700 block uppercase tracking-wider text-[8px]">Skenario Proyek</span>
                <p>
                  Ubah parameter di atas untuk melakukan simulasi "What-If" untuk melihat dinamika lonjakan harga bahan bangunan, penambahan tenaga labor, atau penundaan logistik di lapangan.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* RECHARTS PLOT */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 mb-4 gap-3">
              <div>
                <h4 className="font-bold text-slate-800 text-xs">Kurva S Proyeksi Biaya Kumulatif vs Budget</h4>
                <p className="text-[10px] text-slate-400">Garis kontinu menunjukkan histori real, garis putus-putus menunjukkan prakiraan masa depan.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-[10px] font-bold shrink-0">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-0.5 bg-emerald-600 inline-block"></span> Histori
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-emerald-500 inline-block"></span> Proyeksi
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-0.5 bg-rose-500 inline-block"></span> RAB Target
                </span>
              </div>
            </div>

            <div className="h-[280px] w-full mt-2 font-mono text-[9px] sm:text-[9.5px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={fullChartData}
                  margin={{ top: 10, right: 5, left: -15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    fontSize={8.5}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={8}
                    tickFormatter={(v) => `Rp${v / 1000000}jt`}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip 
                    formatter={(val: any) => [localFormatCurrency(Number(val)), ""]}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                    contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '11px' }}
                  />
                  
                  {/* Reference line for dynamic target budget threshold */}
                  <ReferenceLine 
                    y={targetBudget} 
                    stroke="#f43f5e" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4"
                  />

                  {/* Shading/Area representing the budget safety ceiling */}
                  <Area 
                    type="monotone" 
                    dataKey="budget" 
                    fill="#fff1f2" 
                    fillOpacity={0.15} 
                    stroke="none"
                  />

                  {/* Historical Real Spend cumulative */}
                  <Line 
                    type="monotone" 
                    dataKey="historical" 
                    name="Realisasi Kas" 
                    stroke="#059669" 
                    strokeWidth={3} 
                    dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />

                  {/* Projected continuation trend line */}
                  <Line 
                    type="monotone" 
                    dataKey="projected" 
                    name="Proyeksi Kumulatif" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    strokeDasharray="5 5"
                    dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] sm:text-[11px] text-slate-500 leading-relaxed font-sans">
            <div className="flex items-start gap-2 max-w-xl">
              <Calendar className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-700 block text-[10.5px] uppercase tracking-wider mb-0.5">Jadwal Estimasi Penyelesaian</span>
                <span className="text-slate-500 leading-relaxed">
                  Berdasarkan volume transaksi dan kemajuan pelaporan, estimasi sisa durasi pengerjaan adalah <span className="font-semibold text-slate-800">{remainingMonthsInput} bulan</span>. Total durasi keseluruhan proyek diestimasi selesai dalam <span className="font-semibold text-slate-800">{monthlyData.length + remainingMonthsInput} bulan</span>.
                </span>
              </div>
            </div>
            
            <div className={`p-2 rounded-lg border text-center font-bold font-mono self-start sm:self-center uppercase text-[10px] whitespace-nowrap ${
              isWithinBudget 
                ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                : "bg-rose-50 border-rose-100 text-rose-700"
            }`}>
              {isWithinBudget ? "REKOMENDASI: AMAN" : "TINDAKAN: REVISI RAB"}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
