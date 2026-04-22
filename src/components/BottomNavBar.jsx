import React from 'react';
import { Layout } from 'antd';
import { useTranslation } from 'react-i18next';

const { Footer } = Layout;

const BottomNavBar = ({ activeKey, items, onChange }) => {
    return (
        <Footer className="lg:hidden fixed bottom-4 left-4 right-4 h-18 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-1 z-50 transition-all duration-300">
            <div className="flex justify-around items-center h-full">
                {items.map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                        <button
                            key={item.key}
                            onClick={() => onChange(item.key)}
                            className={`flex flex-col items-center justify-center flex-1 transition-all duration-300 relative group py-2 rounded-2xl ${
                                isActive ? 'text-forest-600' : 'text-slate-400 hover:text-slate-500'
                            }`}
                        >
                            <div className={`text-xl mb-1 transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-1' : 'group-active:scale-95'}`}>
                                {item.icon}
                            </div>
                            <span className={`text-[10px] font-bold tracking-tight transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 h-0 scale-75 overflow-hidden'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="absolute top-1 w-1 h-1 bg-forest-500 rounded-full animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </div>
        </Footer>
    );
};

export default BottomNavBar;
