import { useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import { Icon } from '../../components/ui/icon';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  time: string;
  category: 'System' | 'Alert' | 'Update';
  unread: boolean;
}

export default function OPSNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 1,
      title: 'Daily briefing',
      message: 'Operations briefing is scheduled for 07:45 at the main dock.',
      time: '07:00',
      category: 'Update',
      unread: true,
    },
    {
      id: 2,
      title: 'Weather warning',
      message: 'Sector B is under a strong wind advisory until 14:00.',
      time: '12:20',
      category: 'Alert',
      unread: true,
    },
    {
      id: 3,
      title: 'Crew handover',
      message: 'The morning crew shift has been updated for the harbor route.',
      time: '13:10',
      category: 'System',
      unread: false,
    },
    {
      id: 4,
      title: 'Maintenance reminder',
      message: 'Check the emergency beacon battery on vessel MV Explorer.',
      time: '15:40',
      category: 'Alert',
      unread: false,
    },
  ]);

  const unreadCount = useMemo(() => notifications.filter((item) => item.unread).length, [notifications]);

  const toggleReadStatus = (id: number) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: !item.unread } : item)),
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-[Poppins] text-[#14223d]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-4 lg:px-10 lg:py-6">
        <section className="rounded-md bg-white px-6 py-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)] md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Notifications</h1>
              <p className="mt-1 text-sm text-slate-500">Stay updated with the latest operational alerts.</p>
            </div>

            <div className="rounded-full bg-[#F9FBFF] px-4 py-2 text-sm font-medium text-slate-600">
              {unreadCount} unread
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 ${
                  item.unread
                    ? 'border-[#FF0000]/20 bg-[#FFF5F5]'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${item.unread ? 'bg-[#FF0000]/10' : 'bg-slate-100'}`}>
                    <Icon name="notification" size={16} className={item.unread ? 'fill-[#FF0000]' : 'fill-slate-500'} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-[#14223d]">{item.title}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {item.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs font-medium text-slate-400">{item.time}</span>
                  <button
                    type="button"
                    onClick={() => toggleReadStatus(item.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      item.unread
                        ? 'bg-[#FF0000] text-white hover:bg-[#e60000]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.unread ? 'Mark read' : 'Mark unread'}
                  </button>
                  {item.unread && <span className="h-2.5 w-2.5 rounded-full bg-[#FF0000]" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
