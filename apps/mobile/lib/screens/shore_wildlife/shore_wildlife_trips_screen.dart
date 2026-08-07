import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/mobile_search_field.dart';
import '../../widgets/shore_layout.dart';
import 'shore_wildlife_common.dart';

class ShoreWildlifeTripsScreen extends StatefulWidget {
  const ShoreWildlifeTripsScreen({super.key});

  @override
  State<ShoreWildlifeTripsScreen> createState() =>
      _ShoreWildlifeTripsScreenState();
}

class _ShoreWildlifeTripsScreenState extends State<ShoreWildlifeTripsScreen> {
  final _api = ApiService.instance;
  List<Map<String, dynamic>> _trips = const [];
  bool _loading = true;
  bool _requestInFlight = false;
  String? _error;
  String _query = '';
  String _sort = 'newest';

  @override
  void initState() {
    super.initState();
    _api.addListener(_handleRealtimeUpdate);
    _load();
  }

  @override
  void dispose() {
    _api.removeListener(_handleRealtimeUpdate);
    super.dispose();
  }

  void _handleRealtimeUpdate() => _load(silent: true);

  Future<void> _load({bool silent = false}) async {
    if (_requestInFlight) return;
    _requestInFlight = true;
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final trips = await _api.shoreWildlifeTrips();
      if (!mounted) return;
      setState(() {
        _trips = trips;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (!silent) _error = wildlifeError(error);
      });
    } finally {
      _requestInFlight = false;
    }
  }

  List<Map<String, dynamic>> get _visibleTrips {
    return visibleWildlifeTrips(_trips, _query, _sort);
  }

  @override
  Widget build(BuildContext context) => ShoreLayout(
        portal: ShorePortal.wildlife,
        active: 'trips',
        child: LayoutBuilder(
          builder: (context, constraints) => RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.symmetric(
                horizontal: constraints.maxWidth >= 700 ? 24 : 16,
                vertical: constraints.maxWidth >= 700 ? 28 : 20,
              ),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1100),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const WildlifePageHeading(
                          title: 'Trips',
                          subtitle:
                              'Monitor attendance and complete Wildlife Shore approval',
                        ),
                        const SizedBox(height: 24),
                        WildlifeCard(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              Padding(
                                padding: const EdgeInsets.all(18),
                                child: _filters(),
                              ),
                              const Divider(
                                  height: 1, color: Color(0xFFF1F5F9)),
                              if (_loading)
                                const Padding(
                                  padding: EdgeInsets.all(44),
                                  child: CircularProgressIndicator(),
                                )
                              else if (_error != null)
                                Padding(
                                  padding: const EdgeInsets.all(18),
                                  child: WildlifeErrorPanel(
                                      message: _error!, retry: _load),
                                )
                              else if (_visibleTrips.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.all(18),
                                  child: WildlifeEmptyPanel(
                                      'No trips match your search.'),
                                )
                              else
                                Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    children:
                                        _visibleTrips.map(_tripCard).toList(),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

  Widget _filters() => LayoutBuilder(builder: (context, constraints) {
        final search = TextField(
          onChanged: (value) => setState(() => _query = value),
          style: mobileSearchTextStyle,
          decoration: mobileSearchDecoration(
              'Search vessel, owner, registration or route'),
        );
        final sort = DropdownButtonFormField<String>(
          initialValue: _sort,
          isExpanded: true,
          decoration: const InputDecoration(
            isDense: true,
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: 'newest', child: Text('Newest first')),
            DropdownMenuItem(value: 'oldest', child: Text('Oldest first')),
            DropdownMenuItem(value: 'name', child: Text('Vessel A–Z')),
            DropdownMenuItem(value: 'approval', child: Text('Approval status')),
          ],
          onChanged: (value) => setState(() => _sort = value ?? 'newest'),
        );
        if (constraints.maxWidth >= 560) {
          return Row(children: [
            Expanded(child: search),
            const SizedBox(width: 12),
            SizedBox(width: 180, child: sort),
          ]);
        }
        return Column(children: [
          search,
          const SizedBox(height: 10),
          sort,
        ]);
      });

  Widget _tripCard(Map<String, dynamic> trip) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () => Navigator.pushNamed(
            context,
            '/shore_wildlife_trip',
            arguments: Map<String, dynamic>.from(trip),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFEEF2FF),
                  child: Icon(Icons.directions_boat, color: shoreIndigo),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        trip['boatName']?.toString() ?? 'Unnamed vessel',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        trip['registrationNumber']?.toString() ?? '',
                        style: const TextStyle(fontSize: 12, color: shoreMuted),
                      ),
                    ],
                  ),
                ),
                IconButton.outlined(
                  tooltip: 'Review ${trip['boatName']}',
                  onPressed: () => Navigator.pushNamed(
                    context,
                    '/shore_wildlife_trip',
                    arguments: Map<String, dynamic>.from(trip),
                  ),
                  style: IconButton.styleFrom(
                    foregroundColor: shoreIndigo,
                    side: const BorderSide(color: Color(0xFFC7D2FE)),
                  ),
                  icon: const Icon(Icons.visibility_outlined, size: 18),
                ),
              ]),
              const SizedBox(height: 12),
              _value('Owner', trip['ownerName']),
              _value(
                  'Scheduled', formatShoreDate(trip['scheduledDepartureUtc'])),
              const SizedBox(height: 12),
              Wrap(spacing: 12, runSpacing: 10, children: [
                _badge('SLCG', trip['shoreApproval']),
                _badge('Wildlife Shore', trip['wildlifeShoreApproval']),
              ]),
            ]),
          ),
        ),
      );

  Widget _value(String label, Object? value) => Padding(
        padding: const EdgeInsets.only(top: 5),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 78,
            child: Text(label,
                style: const TextStyle(fontSize: 12, color: shoreMuted)),
          ),
          Expanded(
            child: Text(value?.toString() ?? '—',
                style: const TextStyle(fontSize: 13, color: shoreInk)),
          ),
        ]),
      );

  Widget _badge(String label, Object? value) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label: ',
              style: const TextStyle(fontSize: 11, color: shoreMuted)),
          WildlifeStatusBadge(value?.toString() ?? 'Pending'),
        ],
      );
}
