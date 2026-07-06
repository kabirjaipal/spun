"use client";

import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { Package, Folder, Layers, Scale } from "lucide-react";
import InventoryItemsClient, { type InventoryItem, type TaxRate, type InventoryGroup, type InventoryCategory, type UnitOfMeasurement } from "./InventoryItemsClient";
import InventoryGroupsClient from "./InventoryGroupsClient";
import InventoryCategoriesClient from "./InventoryCategoriesClient";
import UnitsOfMeasurementClient from "./UnitsOfMeasurementClient";

interface Permission {
  c: boolean;
  u: boolean;
  d: boolean;
  e: boolean;
}

interface Props {
  initialData: InventoryItem[];
  taxRates: TaxRate[];
  inventoryGroups: InventoryGroup[];
  inventoryCategories: InventoryCategory[];
  unitsList: UnitOfMeasurement[];
  permissions: {
    inventory: Permission;
    groups: Permission;
    categories: Permission;
    units: Permission;
  };
}

type Section = "items" | "groups" | "categories" | "units";

export default function InventoryClient({
  initialData,
  taxRates,
  inventoryGroups: initialGroups,
  inventoryCategories: initialCategories,
  unitsList: initialUnits,
  permissions,
}: Props) {
  const [activeSection, setActiveSection] = useState<Section>("items");

  // Shared master states so modifications in sub-tabs immediately update dropdowns in Inventory Items tab
  const [items, setItems] = useState<InventoryItem[]>(initialData);
  const [groups, setGroups] = useState<InventoryGroup[]>(initialGroups);
  const [categories, setCategories] = useState<InventoryCategory[]>(initialCategories);
  const [units, setUnits] = useState<UnitOfMeasurement[]>(initialUnits);

  const sections = [
    {
      id: "items" as Section,
      name: "Inventory Items",
      icon: Package,
      description: "Manage stock items",
    },
    {
      id: "groups" as Section,
      name: "Inventory Groups",
      icon: Folder,
      description: "Manage inventory groups",
    },
    {
      id: "categories" as Section,
      name: "Inventory Categories",
      icon: Layers,
      description: "Manage inventory categories",
    },
    {
      id: "units" as Section,
      name: "Units of Measurement",
      icon: Scale,
      description: "Configure unit defaults",
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
              <Button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                variant={isActive ? "default" : "ghost"}
                className="w-full justify-start"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex flex-col">
                  <span>{section.name}</span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Right panel / active content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "items" && (
          <InventoryItemsClient
            data={items}
            setData={setItems}
            taxRates={taxRates}
            inventoryGroups={groups}
            inventoryCategories={categories}
            unitsList={units}
            canCreate={permissions.inventory.c}
            canUpdate={permissions.inventory.u}
            canDelete={permissions.inventory.d}
            canExport={permissions.inventory.e}
          />
        )}
        {activeSection === "groups" && (
          <InventoryGroupsClient
            data={groups}
            setData={setGroups}
            canCreate={permissions.groups.c}
            canUpdate={permissions.groups.u}
            canDelete={permissions.groups.d}
            canExport={permissions.groups.e}
          />
        )}
        {activeSection === "categories" && (
          <InventoryCategoriesClient
            data={categories}
            setData={setCategories}
            canCreate={permissions.categories.c}
            canUpdate={permissions.categories.u}
            canDelete={permissions.categories.d}
            canExport={permissions.categories.e}
          />
        )}
        {activeSection === "units" && (
          <UnitsOfMeasurementClient
            data={units}
            setData={setUnits}
            canCreate={permissions.units.c}
            canUpdate={permissions.units.u}
            canDelete={permissions.units.d}
            canExport={permissions.units.e}
          />
        )}
      </div>
    </div>
  );
}
