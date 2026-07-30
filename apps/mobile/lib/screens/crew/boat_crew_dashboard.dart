import 'package:flutter/material.dart';

import '../../services/api_service.dart';

class BoatCrewDashboard extends StatefulWidget {
  const BoatCrewDashboard({super.key});

  @override
  State<BoatCrewDashboard> createState() => _BoatCrewDashboardState();
}

class _BoatCrewDashboardState extends State<BoatCrewDashboard> {
  late Future<List<Map<String, dynamic>>> _trips;
  bool _updating = false;

  @override
  void initState() {
    super.initState();
    _trips = ApiService.instance.trips();
    ApiService.instance.addListener(_load);
  }

  @override
  void dispose() {
    ApiService.instance.removeListener(_load);
    super.dispose();
  }

  void _load() {
    if (mounted) setState(() => _trips = ApiService.instance.trips());
  }

  Future<void> _updateStatus(String tripId, String status) async {
    if (_updating) return;
    setState(() => _updating = true);
    try {
      await ApiService.instance.updateStatus(tripId, status);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Trip marked ${status.toLowerCase()}.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_message(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) => Theme(
        data: ThemeData.light(),
        child: Scaffold(
          backgroundColor: const Color(0xFFEBECEF),
          appBar: AppBar(
            title: const Text('Boat Crew · Assigned Trips'),
            actions: [
              TextButton(
                onPressed: () async {
                  await ApiService.instance.logout();
                  if (context.mounted) {
                    Navigator.pushNamedAndRemoveUntil(
                        context, '/login', (_) => false);
                  }
                },
                child: const Text('Log Out'),
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () async => _load(),
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _trips,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: MediaQuery.sizeOf(context).height * .65,
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.error_outline,
                                  color: Colors.red, size: 40),
                              const SizedBox(height: 10),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 24),
                                child: Text(_message(snapshot.error!),
                                    textAlign: TextAlign.center),
                              ),
                              const SizedBox(height: 12),
                              OutlinedButton.icon(
                                onPressed: _load,
                                icon: const Icon(Icons.refresh),
                                label: const Text('Retry'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                }
                final trips = snapshot.data ?? const <Map<String, dynamic>>[];
                if (trips.isEmpty) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 220),
                      Center(child: Text('No assigned trips found.')),
                    ],
                  );
                }
                return ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(24),
                  itemCount: trips.length,
                  itemBuilder: (context, index) {
                    final trip = trips[index];
                    return Card(
                      child: ListTile(
                        title: Text(
                            trip['vesselName']?.toString() ?? 'Unnamed vessel'),
                        subtitle: Text(
                          '${trip['route'] ?? 'Route unavailable'} · '
                          'SLCG ${trip['shoreApproval'] ?? 'Pending'} · '
                          'Wildlife Shore ${trip['wildlifeShoreApproval'] ?? 'Pending'}',
                        ),
                        trailing: PopupMenuButton<String>(
                          enabled: !_updating,
                          onSelected: (status) =>
                              _updateStatus(trip['id'].toString(), status),
                          itemBuilder: (_) => ['Ongoing', 'Completed']
                              .map((status) => PopupMenuItem(
                                  value: status, child: Text(status)))
                              .toList(),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      );
}

String _message(Object error) =>
    error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
