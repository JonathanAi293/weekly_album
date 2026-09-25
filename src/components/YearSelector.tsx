"use client";

type Props = {
  years:number[];
  selectedYear:number | null;
  onSelect:(year:number) => void;
  label:string;
};

export function YearSelector({ years, selectedYear, onSelect, label }:Props) {
  if (!years.length) return null;
  return <div className="year-tabs" aria-label={label}>{years.map(year => <button type="button" className={selectedYear === year ? "active" : ""} key={year} aria-pressed={selectedYear === year} onClick={() => onSelect(year)}>{year}</button>)}</div>;
}
