import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/shore_layout.dart';

class ShoreNotificationsScreen extends StatefulWidget {
  const ShoreNotificationsScreen({super.key});
  @override
  State<ShoreNotificationsScreen> createState() => _State();
}

class _State extends State<ShoreNotificationsScreen> {
  List<Map<String, dynamic>> trips = [];
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    _load();
    ApiService.instance.addListener(_load);
  }

  @override
  void dispose() {
    ApiService.instance.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService.instance.trips();
      if (mounted)
        setState(() {
          trips = data;
          loading = false;
          error = null;
        });
    } catch (e) {
      if (mounted)
        setState(() {
          loading = false;
          error = e.toString();
        });
    }
  }

  Map<String, dynamic> _args(Map<String, dynamic> t) => {
        'id': t['id'],
        'vessel': t['vesselName'],
        'owner': t['ownerName'],
        'reg': t['registrationNumber'],
        'time': formatShoreDate(t['scheduledDepartureUtc']),
        'status': t['shoreApproval'],
        'crew': t['crew'] ?? const [],
        'raw': t
      };
  @override
  Widget build(BuildContext context) => ShoreLayout(
      active: 'notifications',
      child: LayoutBuilder(
          builder: (context, constraints) => Padding(
              padding: EdgeInsets.symmetric(
                  horizontal: constraints.maxWidth >= 900
                      ? 32
                      : constraints.maxWidth >= 600
                          ? 22
                          : 12,
                  vertical: constraints.maxWidth >= 600 ? 24 : 14),
              child: Center(
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1152),
                      child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(28),
                          decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: const [
                                BoxShadow(
                                    color: Color(0x0F0F172A),
                                    blurRadius: 30,
                                    offset: Offset(0, 8))
                              ]),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text('Notifications',
                                                style: TextStyle(
                                                    fontSize: 20,
                                                    fontWeight: FontWeight.w600,
                                                    color: shoreInk)),
                                            SizedBox(height: 5),
                                            Text(
                                                'Trip approvals and shared operational updates.',
                                                style: TextStyle(
                                                    fontSize: 12,
                                                    color: shoreMuted))
                                          ]),
                                      IconButton(
                                          onPressed: _load,
                                          icon: const Icon(Icons.refresh,
                                              color: shoreInk))
                                    ]),
                                const Divider(
                                    height: 32, color: Color(0xFFF1F5F9)),
                                Expanded(child: _content())
                              ])))))));
  Widget _content() {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null)
      return Center(
          child: Text(error!, style: const TextStyle(color: Colors.red)));
    if (trips.isEmpty)
      return const Center(
          child:
              Text('No notifications.', style: TextStyle(color: shoreMuted)));
    return ListView.separated(
        itemCount: trips.length,
        separatorBuilder: (_, __) => const Divider(color: Color(0xFFF1F5F9)),
        itemBuilder: (context, index) {
          final t = trips[index], pending = t['shoreApproval'] == 'Pending';
          return ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              onTap: () => Navigator.pushNamed(context, '/trip_details',
                  arguments: _args(t)),
              leading: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                      color: pending
                          ? const Color(0xFFFFFBEB)
                          : const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(10)),
                  child: Icon(
                      pending
                          ? Icons.notification_important_outlined
                          : Icons.notifications_none,
                      color: pending ? const Color(0xFFD97706) : shoreIndigo)),
              title: Text('${t['vesselName']} · ${t['registrationNumber']}',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: pending ? FontWeight.w600 : FontWeight.w400,
                      color: shoreInk)),
              subtitle: Text(
                  pending
                      ? 'Trip requires shore approval.'
                      : 'Shore approval: ${t['shoreApproval']}',
                  style: const TextStyle(fontSize: 12, color: shoreMuted)),
              trailing: const Icon(Icons.chevron_right, color: shoreMuted));
        });
  }
}
