import 'package:flutter/material.dart';
import '../../owner/owner_store.dart';
import '../../widgets/owner_layout.dart';

class BoatOwnerDashboard extends StatefulWidget { const BoatOwnerDashboard({super.key}); @override State<BoatOwnerDashboard> createState() => _BoatOwnerDashboardState(); }
class _BoatOwnerDashboardState extends State<BoatOwnerDashboard> {
  final store = OwnerStore.instance;
  @override void initState() { super.initState(); store.addListener(_refresh); }
  @override void dispose() { store.removeListener(_refresh); super.dispose(); }
  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final active = store.trips.where((trip) => trip.status == OwnerTripStatus.active).toList();
    final upcoming = store.trips.where((trip) => trip.status == OwnerTripStatus.upcoming).toList();
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F9), endDrawer: const OwnerDrawer(),
      body: SafeArea(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Stack(children: [IconButton(onPressed: () => Navigator.pushNamed(context, '/owner_notifications'), icon: const Icon(Icons.notifications_none, size: 28)), if (store.unreadCount > 0) Positioned(right: 5, top: 4, child: CircleAvatar(radius: 8, backgroundColor: Colors.red, child: Text('${store.unreadCount}', style: const TextStyle(fontSize: 9, color: Colors.white))))]),
          Builder(builder: (drawerContext) => IconButton(onPressed: () => Scaffold.of(drawerContext).openEndDrawer(), icon: const Icon(Icons.menu, size: 32))),
        ]),
        const SizedBox(height: 20),
        Row(children: [const CircleAvatar(radius: 32, backgroundImage: AssetImage('assets/images/profile_kamal.jpg')), const SizedBox(width: 16), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Welcome Back', style: TextStyle(fontSize: 12)), Text(store.profile.fullName, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold))])]),
        const SizedBox(height: 28),
        Wrap(spacing: 12, runSpacing: 12, children: [_metric('Registered Boats', store.ownedBoats.length, Icons.directions_boat), _metric('Certified', store.ownedBoats.where((boat) => boat.status == CertificationStatus.certified).length, Icons.verified), _metric('Active Trips', active.length, Icons.sailing), _metric('Upcoming Trips', upcoming.length, Icons.schedule), _metric('Pending Approvals', store.ownedBoats.where((boat) => boat.status == CertificationStatus.pending || boat.status == CertificationStatus.underReview).length, Icons.hourglass_top), _metric('Notifications', store.unreadCount, Icons.notifications)]),
        const SizedBox(height: 28), const Text('My Boats', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)), const SizedBox(height: 12),
        ...store.ownedBoats.map((boat) => ListTile(tileColor: Colors.white, leading: const Icon(Icons.directions_boat), title: Text(boat.name), subtitle: Text('${boat.registrationNumber} · ${boat.status.name}'), trailing: IconButton(icon: const Icon(Icons.info_outline), onPressed: () => Navigator.pushNamed(context, '/owner_boat_info', arguments: boat.id)))),
        const SizedBox(height: 24), const Text('Quick Actions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)), const SizedBox(height: 12),
        Row(children: [Expanded(child: _action('Register Boat', Icons.add, () => Navigator.pushNamed(context, '/owner_new_boat'))), const SizedBox(width: 12), Expanded(child: _action('Schedule Trip', Icons.calendar_month, () => Navigator.pushNamed(context, '/owner_new_trip'))), const SizedBox(width: 12), Expanded(child: _action('Manage Crew', Icons.people, () => Navigator.pushNamed(context, '/owner_my_crew')))]),
        const SizedBox(height: 24), const Text('Active & Upcoming Trips', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        ...[...active, ...upcoming].map((trip) { final boat = store.boat(trip.boatId)!; return ListTile(tileColor: Colors.white, title: Text(boat.name), subtitle: Text('${trip.destination} · ${trip.departure}'), trailing: IconButton(icon: const Icon(Icons.info_outline), onPressed: () => Navigator.pushNamed(context, '/owner_trip_info', arguments: trip.id))); }),
      ]))),
    );
  }

  Widget _metric(String title, int value, IconData icon) => SizedBox(width: 155, child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon, color: const Color(0xFF152238)), const SizedBox(height: 8), Text('$value', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)), Text(title, style: const TextStyle(fontSize: 11))])));
  Widget _action(String title, IconData icon, VoidCallback onTap) => ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF152238), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 18)), onPressed: onTap, child: Column(children: [Icon(icon), Text(title, textAlign: TextAlign.center)]));
}
