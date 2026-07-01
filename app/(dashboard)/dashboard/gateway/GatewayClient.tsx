"use client";

import React, { useState } from "react";
import LedgersClient from "../ledgers/LedgersClient";
import LedgerGroupsClient from "../ledger-groups/LedgerGroupsClient";
import JobsClient from "../jobs/JobsClient";
import MillsClient from "../mills/MillsClient";
import BrokersHasteClient from "./BrokersHasteClient";
import { BookOpen, FolderTree, Briefcase, Building, Users } from "lucide-react";

interface Permission {
  c: boolean;
  u: boolean;
  d: boolean;
  e: boolean;
}

interface Props {
  ledgers: any[];
  ledgerGroups: any[];
  jobs: any[];
  mills: any[];
  brokersHaste: any[];
  permissions: {
    ledgers: Permission;
    groups: Permission;
    jobs: Permission;
    mills: Permission;
    brokersHaste: Permission;
  };
}

type Section = "ledgers" | "groups" | "jobs" | "mills" | "brokers_haste";

export default function GatewayClient({
  ledgers,
  ledgerGroups,
  jobs,
  mills,
  brokersHaste,
  permissions,
}: Props) {
  const [activeSection, setActiveSection] = useState<Section>("ledgers");

  const sections = [
    {
      id: "ledgers" as Section,
      name: "Account (Ledger) Master",
      icon: BookOpen,
      description: "Manage accounts and ledgers",
    },
    {
      id: "groups" as Section,
      name: "Group Master",
      icon: FolderTree,
      description: "Structure account groups",
    },
    {
      id: "jobs" as Section,
      name: "Job Master",
      icon: Briefcase,
      description: "Configure job workers and rates",
    },
    {
      id: "mills" as Section,
      name: "Mill Master",
      icon: Building,
      description: "Configure processing mills",
    },
    {
      id: "brokers_haste" as Section,
      name: "Brokers & Haste",
      icon: Users,
      description: "Manage brokers and delivery agents",
    },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full min-h-[500px]">
      {/* Left panel / sections */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-2 border-r border-border pr-0 md:pr-4">
        <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm font-medium whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex flex-col">
                  <span>{section.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel / active content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "ledgers" && (
          <LedgersClient
            initialData={ledgers}
            groups={ledgerGroups}
            canCreate={permissions.ledgers.c}
            canUpdate={permissions.ledgers.u}
            canDelete={permissions.ledgers.d}
            canExport={permissions.ledgers.e}
          />
        )}
        {activeSection === "groups" && (
          <LedgerGroupsClient
            initialData={ledgerGroups}
            canCreate={permissions.groups.c}
            canUpdate={permissions.groups.u}
            canDelete={permissions.groups.d}
            canExport={permissions.groups.e}
          />
        )}
        {activeSection === "jobs" && (
          <JobsClient
            initialData={jobs}
            canCreate={permissions.jobs.c}
            canUpdate={permissions.jobs.u}
            canDelete={permissions.jobs.d}
            canExport={permissions.jobs.e}
          />
        )}
        {activeSection === "mills" && (
          <MillsClient
            initialData={mills}
            canCreate={permissions.mills.c}
            canUpdate={permissions.mills.u}
            canDelete={permissions.mills.d}
            canExport={permissions.mills.e}
          />
        )}
        {activeSection === "brokers_haste" && (
          <BrokersHasteClient
            initialData={brokersHaste}
            canCreate={permissions.brokersHaste.c}
            canUpdate={permissions.brokersHaste.u}
            canDelete={permissions.brokersHaste.d}
            canExport={permissions.brokersHaste.e}
          />
        )}
      </div>
    </div>
  );
}
