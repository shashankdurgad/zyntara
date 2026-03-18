"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MapPin, Briefcase, Target, AlertTriangle, Monitor, Sparkles, Heart, User } from "lucide-react";

interface PersonaData {
    profile: {
        name: string;
        demographics: {
            age: string;
            location: string;
            job_title: string;
        };
        psychographics: {
            goals: string[];
            frustrations: string[];
            interests: string[];
            values: string[];
        };
        browsing_behavior: string;
        relationship_with_site: string;
    };
    analysis_context: string;
}

export function PersonaProfileCard({ data }: { data: PersonaData }) {
    if (!data?.profile) return null;

    const { profile } = data;
    const { name, demographics, psychographics, browsing_behavior, relationship_with_site } = profile;

    // Helper to get initials
    const initials = name
        ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "US";

    return (
        <Card className="h-full shadow-lg border border-primary/10 flex flex-col overflow-hidden bg-card/80 backdrop-blur-sm">
            {/* Header / Cover Area */}
            <div className="h-24 bg-gradient-to-r from-primary via-pink-500 to-amber-500 relative">
                <div className="absolute -bottom-10 left-6">
                    <Avatar className="w-20 h-20 border-4 border-card shadow-lg">
                        <AvatarImage src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${name}&backgroundColor=e9d5ff`} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            <CardHeader className="mt-10 pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-bold">{name}</CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-1 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Briefcase className="w-3 h-3" /> {demographics.job_title}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-3 h-3" /> {demographics.location}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <User className="w-3 h-3" /> {demographics.age}
                            </span>
                        </CardDescription>
                    </div>
                </div>

                {/* Tags / Badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                    {psychographics.values.slice(0, 3).map((val, i) => (
                        <Badge key={i} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                            <Heart className="w-3 h-3 mr-1" /> {val}
                        </Badge>
                    ))}
                    {psychographics.interests.slice(0, 3).map((int, i) => (
                        <Badge key={i} variant="outline" className="text-muted-foreground">
                            <Sparkles className="w-3 h-3 mr-1" /> {int}
                        </Badge>
                    ))}
                </div>
            </CardHeader>

            <Separator />

            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Goals & Frustrations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2 text-primary uppercase tracking-wider">
                            <Target className="w-4 h-4" /> Goals
                        </h4>
                        <ul className="space-y-2">
                            {psychographics.goals.map((goal, i) => (
                                <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span> {goal}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2 text-destructive uppercase tracking-wider">
                            <AlertTriangle className="w-4 h-4" /> Frustrations
                        </h4>
                        <ul className="space-y-2">
                            {psychographics.frustrations.map((frust, i) => (
                                <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                    <span className="text-destructive mt-1">•</span> {frust}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-muted/30 p-4 rounded-lg border">
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                            <Monitor className="w-4 h-4 text-primary" /> Browsing Style
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {browsing_behavior}
                        </p>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-lg border border-border">
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-amber-500" /> Relationship with Site
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {relationship_with_site}
                        </p>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
