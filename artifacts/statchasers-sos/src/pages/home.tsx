import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import { SosFilters } from "@/components/sos/sos-filters";
import { InsightCards } from "@/components/sos/insight-cards";
import { TeamMatrix } from "@/components/sos/team-matrix";
import { PlayerMatrix } from "@/components/sos/player-matrix";
import { FpaTable } from "@/components/sos/fpa-table";
import { ScheduleTable } from "@/components/sos/schedule-table";
import { fetchTeamSosCsv, fetchPlayerSosCsv } from "@/lib/sos-client";

export default function Home() {
  const { filters, setFilters } = useFilters();
  const [activeTab, setActiveTab] = useState("team");

  useEffect(() => {
    document.title = "Fantasy Football Strength of Schedule | 2026 SOS by Team & Player";
    
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'View 2026 fantasy football strength of schedule by team, player, position, scoring format, rest-of-season, and fantasy playoff weeks.');
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  };

  const handleExportTeam = async () => {
    try {
      // CSV is built client-side from the static SOS JSON.
      const blob = await fetchTeamSosCsv({
        season: filters.season,
        position: filters.position as any,
        scoring: filters.scoring as any,
        metric: filters.metric as any,
      });
      downloadBlob(blob, `statchasers_team_sos_${filters.season}_${filters.position}.csv`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPlayer = async () => {
    try {
      const blob = await fetchPlayerSosCsv({
        season: filters.season,
        position: filters.position as any,
        scoring: filters.scoring as any,
        metric: filters.metric as any,
      });
      downloadBlob(blob, `statchasers_player_sos_${filters.season}_${filters.position}.csv`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SosFilters filters={filters} setFilters={setFilters} />
      
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Fantasy Football Strength of Schedule</h1>
          <p className="text-muted-foreground max-w-3xl">
            The analyst's edge. Data-dense schedule intelligence for fantasy players who want to find the angle before their league does.
          </p>
        </header>

        <InsightCards filters={filters} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 md:w-[600px]">
              <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Team SOS</TabsTrigger>
              <TabsTrigger value="player" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Player SOS</TabsTrigger>
              <TabsTrigger value="fpa" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">FPA</TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Schedule</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportTeam} data-testid="btn-export-team">
              <Download className="w-4 h-4 mr-2" />
              Export Team SOS
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPlayer} data-testid="btn-export-player">
              <Download className="w-4 h-4 mr-2" />
              Export Player SOS
            </Button>
          </div>
        </div>

        {activeTab === "team" && <TeamMatrix filters={filters} />}
        {activeTab === "player" && <PlayerMatrix filters={filters} />}
        {activeTab === "fpa" && <FpaTable filters={filters} />}
        {activeTab === "schedule" && <ScheduleTable filters={filters} />}

        <section className="mt-16 bg-card border border-border p-6 rounded-lg max-w-4xl">
          <h2 className="text-xl font-bold mb-4 font-mono tracking-tight text-primary">OUR METHODOLOGY</h2>
          <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
            <p>
              StatChasers SOS uses adjusted fantasy points allowed by position, normalized to remove schedule bias so defenses are compared fairly across opponents.
            </p>
            <p>
              Instead of looking at raw points allowed (which unfairly penalizes defenses that have played elite offenses), our model adjusts for the strength of the opponent. This gives you a much clearer picture of whether a matchup is a true "Smash Spot" or a trap.
            </p>
            <p>
              The color coding highlights the opportunity: <span className="text-emerald-600 font-semibold">Green (Smash Spot/Favorable)</span> indicates a highly exploitable matchup, while <span className="text-red-600 font-semibold">Red (Very Tough)</span> warns of a shutdown defense.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
