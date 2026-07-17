import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class BoatCrewDashboard extends StatefulWidget {
  const BoatCrewDashboard({super.key});
  @override
  State<BoatCrewDashboard> createState() => _BoatCrewDashboardState();
}

class _BoatCrewDashboardState extends State<BoatCrewDashboard> {
  late Future<List<Map<String, dynamic>>> _trips;
  @override
  void initState() { super.initState(); _load(); ApiService.instance.addListener(_load); }
  @override
  void dispose() { ApiService.instance.removeListener(_load); super.dispose(); }
  void _load() { if (mounted) setState(() => _trips = ApiService.instance.trips()); }

  @override
  Widget build(BuildContext context) => Theme(
    data: ThemeData.light(),
    child: Scaffold(
      backgroundColor: const Color(0xFFEBECEF),
      appBar: AppBar(title: const Text('Boat Crew · Assigned Trips'), actions: [
        TextButton(onPressed: () async { await ApiService.instance.logout(); if (context.mounted) Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false); }, child: const Text('Log Out')),
      ]),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _trips,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          return ListView.builder(
            padding: const EdgeInsets.all(24), itemCount: snapshot.data!.length,
            itemBuilder: (context, index) {
              final trip = snapshot.data![index];
              return Card(child: ListTile(
                title: Text(trip['vesselName']),
                subtitle: Text("${trip['route']} · Shore ${trip['shoreApproval']}"),
                trailing: PopupMenuButton<String>(
                  onSelected: (status) async { await ApiService.instance.updateStatus(trip['id'], status); _load(); },
                  itemBuilder: (_) => ['Ongoing', 'Completed'].map((status) => PopupMenuItem(value: status, child: Text(status))).toList(),
                ),
              ));
            },
          );
        },
      ),
    ),
  );
}
