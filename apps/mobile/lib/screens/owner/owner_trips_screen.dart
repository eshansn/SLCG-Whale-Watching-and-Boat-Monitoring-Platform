import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/mobile_search_field.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

enum OwnerTripSort { name, time, status }

class OwnerTripsScreen extends StatefulWidget {
  const OwnerTripsScreen({super.key});

  @override
  State<OwnerTripsScreen> createState() => _OwnerTripsScreenState();
}

class _OwnerTripsScreenState extends State<OwnerTripsScreen> {
  final _api = ApiService.instance;
  final _search = TextEditingController();
  List<Map<String, dynamic>> _trips = [];
  OwnerTripSort _sort = OwnerTripSort.time;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api.addListener(_changed);
    _load();
  }

  @override
  void dispose() {
    _api.removeListener(_changed);
    _search.dispose();
    super.dispose();
  }

  void _changed() => _load(silent: true);

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final trips = await _api.trips();
      if (!mounted) return;
      setState(() {
        _trips = trips;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = ownerError(error);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.text.trim().toLowerCase();
    final trips =
        _trips.where((trip) => ownerTripMatches(trip, query)).toList();
    trips.sort((a, b) => compareOwnerTrips(a, b, _sort.name));

    return OwnerLayout(
      active: 'trips',
      title: 'My Trips',
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
          children: [
            OwnerEmptyPanel(
              title: 'Start New Trips!',
              message:
                  'Set up the schedule and preferences for an upcoming tour.',
              actionLabel: 'Schedule Trip',
              onAction: () async {
                final changed =
                    await Navigator.pushNamed(context, '/owner_new_trip');
                if (changed == true) _load();
              },
            ),
            const SizedBox(height: 28),
            const Text('My Trips',
                style: TextStyle(fontSize: 23, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Review your scheduled vessel departures.',
                style: TextStyle(color: ownerMuted)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    style: mobileSearchTextStyle,
                    decoration: mobileSearchDecoration('Search'),
                  ),
                ),
                const SizedBox(width: 10),
                DropdownButtonHideUnderline(
                  child: DropdownButton<OwnerTripSort>(
                    value: _sort,
                    borderRadius: BorderRadius.circular(10),
                    onChanged: (value) =>
                        setState(() => _sort = value ?? _sort),
                    items: const [
                      DropdownMenuItem(
                          value: OwnerTripSort.name, child: Text('Name')),
                      DropdownMenuItem(
                          value: OwnerTripSort.time, child: Text('Time')),
                      DropdownMenuItem(
                          value: OwnerTripSort.status, child: Text('Status')),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (_loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator()))
            else if (_error != null)
              OwnerErrorPanel(message: _error!, retry: _load)
            else if (trips.isEmpty)
              OwnerEmptyPanel(
                title: query.isEmpty ? 'No trips scheduled' : 'No trips found',
                message: query.isEmpty
                    ? 'Schedule a trip to see it here.'
                    : 'Try a different vessel, registration, or date.',
                icon: Icons.calendar_month_outlined,
              )
            else
              ...trips.map(_tripCard),
          ],
        ),
      ),
    );
  }

  Widget _tripCard(Map<String, dynamic> trip) {
    final approval = '${trip['shoreApproval']}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: OwnerCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFDCE8F5),
                  foregroundColor: ownerNavy,
                  child: Icon(Icons.sailing_rounded),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${trip['vesselName']}',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700)),
                      Text('${trip['registrationNumber']}',
                          style: const TextStyle(color: ownerMuted)),
                    ],
                  ),
                ),
                OwnerStatusBadge(approval),
              ],
            ),
            const SizedBox(height: 16),
            _line('Scheduled', formatOwnerDate(trip['scheduledDepartureUtc'])),
            _line('Trip status', '${trip['status']}'),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pushNamed(
                    context, '/owner_trip_info',
                    arguments: '${trip['id']}'),
                child: const Text('Info'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _line(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 90,
              child: Text(label,
                  style: const TextStyle(
                      color: ownerMuted, fontWeight: FontWeight.w600)),
            ),
            Expanded(child: Text(value)),
          ],
        ),
      );
}
