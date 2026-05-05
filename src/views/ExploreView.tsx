import React, { useState, useMemo } from 'react';
import { AppState } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';

export function ExploreView({ state }: { state: AppState }) {
  const { dataset } = state;
  const [selectedCol, setSelectedCol] = useState<string | null>(dataset?.columns[0]?.name || null);
  const [scatterX, setScatterX] = useState<string | null>(dataset?.columns.filter(c => c.type === 'numeric')[0]?.name || null);
  const [scatterY, setScatterY] = useState<string | null>(dataset?.columns.filter(c => c.type === 'numeric')[1]?.name || null);

  if (!dataset) return null;

  const colInfo = dataset.columns.find(c => c.name === selectedCol);
  
  // Histogram Data
  const histData = useMemo(() => {
    if (!colInfo || !dataset.chartData) return [];
    
    if (colInfo.type === 'categorical' || colInfo.type === 'text') {
      const counts: Record<string, number> = {};
      dataset.chartData.forEach(row => {
        let val = row[colInfo.name] || 'N/A';
        val = String(val).slice(0, 15);
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 10);
    } else {
      // Numeric pseudo-binned
      const values = dataset.chartData.map(r => Number(r[colInfo.name])).filter(v => !isNaN(v));
      if (values.length === 0) return [];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const bins = 10;
      const binSize = (max - min) / bins;
      const hist = Array.from({length: bins}).map((_, i) => ({
        name: `${(min + i * binSize).toFixed(1)} - ${(min + (i+1) * binSize).toFixed(1)}`,
        min: min + i * binSize,
        max: min + (i+1) * binSize,
        count: 0
      }));
      values.forEach(v => {
        const binIdx = Math.min(Math.floor((v - min) / binSize), bins - 1);
        if (hist[binIdx]) hist[binIdx].count++;
      });
      return hist;
    }
  }, [colInfo, dataset.chartData]);

  // Scatter Data
  const scatterData = useMemo(() => {
    if (!scatterX || !scatterY || !dataset.chartData) return [];
    return dataset.chartData.map(row => ({
      x: Number(row[scatterX]),
      y: Number(row[scatterY])
    })).filter(p => !isNaN(p.x) && !isNaN(p.y));
  }, [scatterX, scatterY, dataset.chartData]);

  const numericCols = dataset.columns.filter(c => c.type === 'numeric');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 text-white">
      <div className="mb-10">
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter italic serif">
          Data <span className="font-bold not-italic">Explorer.</span>
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-white/40 mt-4 max-w-md">
          Explore interactive distributions and relationships in your dataset before modeling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Distribution Analysis */}
        <div className="glass-panel p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/50">Distribution Analysis</h3>
            <select 
              value={selectedCol || ''} 
              onChange={e => setSelectedCol(e.target.value)}
              className="bg-[#020202] border border-white/10 text-white text-[10px] uppercase tracking-widest p-2 outline-none font-bold"
            >
              {dataset.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickMargin={10} anchor="end" angle={-15} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.2)', borderRadius: '2px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}
                />
                <Bar dataKey="count" fill="#ffffff" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feature Relationships */}
        <div className="glass-panel p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6 gap-2">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/50">Feature Relationships</h3>
            <div className="flex gap-2">
              <select 
                value={scatterX || ''} 
                onChange={e => setScatterX(e.target.value)}
                className="bg-[#020202] border border-white/10 text-white text-[10px] uppercase tracking-widest p-2 outline-none font-bold max-w-[120px]"
              >
                {numericCols.map(c => <option key={c.name} value={c.name}>X: {c.name}</option>)}
              </select>
              <select 
                value={scatterY || ''} 
                onChange={e => setScatterY(e.target.value)}
                className="bg-[#020202] border border-white/10 text-white text-[10px] uppercase tracking-widest p-2 outline-none font-bold max-w-[120px]"
              >
                {numericCols.map(c => <option key={c.name} value={c.name}>Y: {c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="h-72 w-full mt-4">
            {scatterX && scatterY ? (
               <ResponsiveContainer width="100%" height="100%">
                 <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                   <XAxis type="number" dataKey="x" name={scatterX} stroke="rgba(255,255,255,0.3)" fontSize={10} />
                   <YAxis type="number" dataKey="y" name={scatterY} stroke="rgba(255,255,255,0.3)" fontSize={10} />
                   <ZAxis type="number" range={[20, 20]} />
                   <Tooltip 
                      cursor={{strokeDasharray: '3 3'}}
                      contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.2)', borderRadius: '2px', fontSize: '10px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                   <Scatter data={scatterData} fill="rgba(34, 211, 238, 0.6)" />
                 </ScatterChart>
               </ResponsiveContainer>
            ) : (
               <div className="flex-1 flex items-center justify-center text-[10px] uppercase tracking-widest text-white/30">
                 Need 2 numeric columns for Scatter Plot
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
