import 'package:flutter/material.dart';
import '../../owner/owner_store.dart';
import '../../widgets/owner_layout.dart';

class OwnerNotificationsScreen extends StatefulWidget {
  const OwnerNotificationsScreen({super.key});
  @override State<OwnerNotificationsScreen> createState() => _OwnerNotificationsState();
}

class _OwnerNotificationsState extends State<OwnerNotificationsScreen> {
  final store = OwnerStore.instance;
  @override void initState() { super.initState(); store.addListener(_refresh); }
  @override void dispose() { store.removeListener(_refresh); super.dispose(); }
  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return OwnerLayout(
      title: 'Notifications',
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            TextButton(onPressed: store.markAllRead, child: const Text('Mark all read')),
            TextButton(onPressed: store.notifications.isEmpty ? null : _confirmClear, child: const Text('Delete all')),
          ]),
        ),
        Expanded(
          child: store.notifications.isEmpty
              ? const Center(child: Text('No notifications'))
              : ListView.separated(
                  padding: const EdgeInsets.all(24),
                  itemCount: store.notifications.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) {
                    final notification = store.notifications[index];
                    return ListTile(
                      onTap: () => store.markRead(notification.id),
                      leading: Stack(children: [
                        const Icon(Icons.notifications_none),
                        if (!notification.isRead) const Positioned(right: 0, child: CircleAvatar(radius: 4, backgroundColor: Colors.red)),
                      ]),
                      title: Text(notification.title, style: TextStyle(fontWeight: notification.isRead ? FontWeight.normal : FontWeight.bold)),
                      subtitle: Text('${notification.category} · ${_time(notification.timestamp)}\n${notification.message}'),
                      isThreeLine: true,
                      trailing: IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => store.deleteNotification(notification.id)),
                    );
                  },
                ),
        ),
      ]),
    );
  }

  String _time(DateTime timestamp) { final difference = DateTime.now().difference(timestamp); if (difference.inMinutes < 60) return '${difference.inMinutes}m ago'; if (difference.inHours < 24) return '${difference.inHours}h ago'; return '${difference.inDays}d ago'; }
  Future<void> _confirmClear() async { final confirmed = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(title: const Text('Delete all notifications?'), actions: [TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Delete'))])) ?? false; if (confirmed) store.clearNotifications(); }
}
