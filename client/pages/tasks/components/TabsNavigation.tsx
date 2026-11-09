import React from "react";

interface TabsNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabsNavigation: React.FC<TabsNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: "new-task", label: "New Task" },
    { id: "todo-list", label: "To Do List" },
    { id: "live-chat", label: "Live Chat" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="flex justify-center mb-8">
      <div className="bg-white dark:bg-card border border-transparent dark:border-border rounded-lg shadow-md p-1 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-6 py-3 rounded-md font-medium transition-colors ${activeTab === tab.id
                ? "bg-sheraton-gold text-slate-900 shadow-sm"
                : "text-gray-600 dark:text-muted-foreground hover:text-sheraton-navy dark:hover:text-foreground"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabsNavigation;
