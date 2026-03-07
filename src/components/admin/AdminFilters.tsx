import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface Filters {
  search: string;
  status: string;
  category: string;
  priority: string;
  department: string;
  dateRange: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export const defaultFilters: Filters = {
  search: "",
  status: "all",
  category: "all",
  priority: "all",
  department: "all",
  dateRange: "all",
  dateFrom: undefined,
  dateTo: undefined,
};

interface AdminFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  departments: string[];
}

export default function AdminFilters({ filters, onChange, departments }: AdminFiltersProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const handleDateRange = (value: string) => {
    const now = new Date();
    if (value === "7d") {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      set({ dateRange: value, dateFrom: from, dateTo: now });
    } else if (value === "30d") {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      set({ dateRange: value, dateFrom: from, dateTo: now });
    } else if (value === "custom") {
      set({ dateRange: value });
    } else {
      set({ dateRange: "all", dateFrom: undefined, dateTo: undefined });
    }
  };

  const isDefault = JSON.stringify(filters) === JSON.stringify(defaultFilters);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by ref, subject, student name or ID..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.category} onValueChange={(v) => set({ category: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="academic">Academic</SelectItem>
            <SelectItem value="infrastructure">Infrastructure</SelectItem>
            <SelectItem value="administrative">Administrative</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(v) => set({ priority: v })}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        {departments.length > 0 && (
          <Select value={filters.department} onValueChange={(v) => set({ department: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filters.dateRange} onValueChange={handleDateRange}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Date Range" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={() => onChange(defaultFilters)}>
            <X className="h-4 w-4 mr-1" /> Reset
          </Button>
        )}
      </div>

      {filters.dateRange === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !filters.dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, "PP") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => set({ dateFrom: d })} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !filters.dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(filters.dateTo, "PP") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => set({ dateTo: d })} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
