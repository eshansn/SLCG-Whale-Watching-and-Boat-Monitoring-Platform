import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';

class BoatOwnerDashboard extends StatefulWidget {
  const BoatOwnerDashboard({super.key});
  @override
  State<BoatOwnerDashboard> createState() => _BoatOwnerDashboardState();
}

class _BoatOwnerDashboardState extends State<BoatOwnerDashboard> {
  List<Map<String, dynamic>> boats = [];
  List<Map<String, dynamic>> trips = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => loading = true);
    try {
      final results = await Future.wait([
        ApiService.instance.boats(),
        ApiService.instance.trips(),
      ]);
      if (!mounted) return;
      setState(() {
        boats = results[0];
        trips = results[1];
        loading = false;
        error = null;
      });
    } catch (exception) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = exception.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _openAndReload(String route) async {
    final changed = await Navigator.pushNamed(context, route);
    if (changed == true) await _load();
  }

  bool _isActive(Map<String, dynamic> trip) =>
      trip['status']?.toString().toLowerCase() == 'ongoing';

  bool _isUpcoming(Map<String, dynamic> trip) {
    final status = trip['status']?.toString().toLowerCase();
    return status == 'scheduled' || status == 'boarding';
  }

  @override
  Widget build(BuildContext context) {
    final active = trips.where(_isActive).toList();
    final upcoming = trips.where(_isUpcoming).toList();
    final visibleTrips = [...active, ...upcoming];
    final certified = boats
        .where((boat) => boat['approval']?.toString() == 'Approved')
        .length;
    final pending =
        boats.where((boat) => boat['approval']?.toString() == 'Pending').length;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F9),
      endDrawer: const OwnerDrawer(),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      onPressed: () =>
                          Navigator.pushNamed(context, '/owner_notifications'),
                      icon: const Icon(Icons.notifications_none, size: 28),
                    ),
                    Builder(
                      builder: (drawerContext) => IconButton(
                        onPressed: () =>
                            Scaffold.of(drawerContext).openEndDrawer(),
                        icon: const Icon(Icons.menu, size: 32),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(children: [
                  const CircleAvatar(
                    radius: 32,
                    child: Icon(Icons.person_outline, size: 34),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Welcome Back',
                          style: TextStyle(fontSize: 12)),
                      Text(
                          boats.firstOrNull?['ownerName']?.toString() ??
                              'Boat Owner',
                          style: const TextStyle(
                              fontSize: 22, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ]),
                const SizedBox(height: 28),
                if (loading)
                  const Center(child: CircularProgressIndicator())
                else if (error != null)
                  _errorState()
                else ...[
                  Wrap(spacing: 12, runSpacing: 12, children: [
                    _metric('Registered Boats', boats.length,
                        Icons.directions_boat),
                    _metric('Certified', certified, Icons.verified),
                    _metric('Active Trips', active.length, Icons.sailing),
                    _metric('Upcoming Trips', upcoming.length, Icons.schedule),
                    _metric('Pending Approvals', pending, Icons.hourglass_top),
                  ]),
                  const SizedBox(height: 28),
                  const Text('My Boats',
                      style:
                          TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (boats.isEmpty)
                    _emptyState(
                      icon: Icons.directions_boat_outlined,
                      message: 'There are no boats registered yet.',
                      buttonLabel: 'Register a Boat',
                      route: '/owner_new_boat',
                    )
                  else
                    ...boats.map(_boatTile),
                  const SizedBox(height: 24),
                  const Text('Quick Actions',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: _action('Register Boat', Icons.add,
                            () => _openAndReload('/owner_new_boat'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _action('Schedule Trip', Icons.calendar_month,
                            () => _openAndReload('/owner_new_trip'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _action(
                            'Manage Crew',
                            Icons.people,
                            () => Navigator.pushNamed(
                                context, '/owner_my_crew'))),
                  ]),
                  const SizedBox(height: 24),
                  const Text('Active & Upcoming Trips',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (visibleTrips.isEmpty)
                    _emptyState(
                      icon: Icons.calendar_month_outlined,
                      message: 'There are no active or upcoming trips yet.',
                      buttonLabel: 'Schedule a Trip',
                      route: '/owner_new_trip',
                    )
                  else
                    ...visibleTrips.map(_tripTile),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _boatTile(Map<String, dynamic> boat) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          tileColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          leading: const Icon(Icons.directions_boat),
          title: Text(boat['name']?.toString() ?? 'Unnamed boat'),
          subtitle: Text(
              '${boat['registrationNumber'] ?? 'No registration'} · ${boat['approval'] ?? 'Pending'}'),
          trailing: IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: () => Navigator.pushNamed(context, '/owner_boats'),
          ),
        ),
      );

  Widget _tripTile(Map<String, dynamic> trip) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          tileColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          title: Text(trip['vesselName']?.toString() ?? 'Unnamed boat'),
          subtitle: Text(
              '${trip['route'] ?? 'Route not set'} · ${trip['scheduledDepartureUtc'] ?? ''}\nSLCG ${trip['shoreApproval'] ?? 'Pending'} · Wildlife Shore ${trip['wildlifeShoreApproval'] ?? 'Pending'}'),
          isThreeLine: true,
          trailing: IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: () => Navigator.pushNamed(context, '/owner_trips'),
          ),
        ),
      );

  Widget _emptyState({
    required IconData icon,
    required String message,
    required String buttonLabel,
    required String route,
  }) =>
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(children: [
          Icon(icon, size: 42, color: Colors.blueGrey),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => _openAndReload(route),
            icon: const Icon(Icons.add),
            label: Text(buttonLabel),
          ),
        ]),
      );

  Widget _errorState() => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(children: [
          const Icon(Icons.cloud_off, size: 42, color: Colors.redAccent),
          const SizedBox(height: 12),
          Text(error!, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
            label: const Text('Try Again'),
          ),
        ]),
      );

  Widget _metric(String title, int value, IconData icon) => SizedBox(
      width: 155,
      child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(12)),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: const Color(0xFF152238)),
            const SizedBox(height: 8),
            Text('$value',
                style:
                    const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            Text(title, style: const TextStyle(fontSize: 11))
          ])));

  Widget _action(
          String title, IconData icon, VoidCallback onTap) =>
      ElevatedButton(
          style:
              ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF152238),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 18)),
          onPressed: onTap,
          child: Column(children: [
            Icon(icon),
            Text(title, textAlign: TextAlign.center)
          ]));
}
