import React from 'react';

const WEEK_DAYS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' }
];

export default function DailyView({ tasks = [], activeTab, setActiveTab, toggleTask }) {
  const today = new Date().getDay();

  const visibleDays = WEEK_DAYS.filter(day => {
    if (day.id === today) return true;
    return tasks.some(task => {
      const isSameDay = Number(task.dayOfWeek) === day.id || task.dayId === day.id;
      return isSameDay && !task.completed;
    });
  });

  return (
    <div className="w-full flex flex-col gap-4 p-4">
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {visibleDays.map(day => {
          const isToday = day.id === today;
          const isActive = activeTab === day.id;
          const hasPending = tasks.some(t => (Number(t.dayOfWeek) === day.id || t.dayId === day.id) && !t.completed);

          return (
            <button
              key={day.id}
              onClick={() => setActiveTab(day.id)}
              className={`relative px-4 py-2 rounded-lg font-medium transition-all ${
                isActive ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isToday ? 'Hoje' : day.label}
              {hasPending && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full border border-white" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 mt-2">
        {tasks
          .filter(task => Number(task.dayOfWeek) === activeTab || task.dayId === activeTab)
          .map(task => (
            <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100">
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                }`}
              >
                {task.completed && '✓'}
              </button>
              <span className={`text-gray-800 ${task.completed ? 'line-through text-gray-400' : ''}`}>
                {task.title}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
