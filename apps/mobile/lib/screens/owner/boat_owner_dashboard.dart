import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class BoatOwnerDashboard extends StatefulWidget {
  const BoatOwnerDashboard({super.key});

  @override
  State<BoatOwnerDashboard> createState() => _BoatOwnerDashboardState();
}

class _BoatOwnerDashboardState extends State<BoatOwnerDashboard>
    with SingleTickerProviderStateMixin {
  final _api = ApiService.instance;
  late final AnimationController _gradientController;
  List<Map<String, dynamic>> _boats = const [];
  List<Map<String, dynamic>> _crew = const [];
  List<Map<String, dynamic>> _trips = const [];
  Map<String, dynamic>? _profile;
  Uint8List? _profilePhoto;
  bool _loading = true;
  String? _error;
  Timer? _clockTimer;

  @override
  void initState() {
    super.initState();
    _gradientController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 11),
    )..repeat(reverse: true);
    _clockTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
    _api.addListener(_realtimeRefresh);
    _load();
  }

  @override
  void dispose() {
    _api.removeListener(_realtimeRefresh);
    _clockTimer?.cancel();
    _gradientController.dispose();
    super.dispose();
  }

  void _realtimeRefresh() => _load(silent: true);

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final values = await Future.wait([
        _api.boats(),
        _api.trips(),
        _api.ownerCrew(),
        _api.ownerProfile(),
        _api.ownerProfilePhoto(),
      ]);
      if (!mounted) return;
      setState(() {
        _boats = values[0] as List<Map<String, dynamic>>;
        _trips = values[1] as List<Map<String, dynamic>>;
        _crew = values[2] as List<Map<String, dynamic>>;
        _profile = values[3] as Map<String, dynamic>;
        _profilePhoto = values[4] as Uint8List?;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (!silent) _error = ownerError(error);
      });
    }
  }

  Future<void> _open(String route, {Object? arguments}) async {
    await Navigator.pushNamed(context, route, arguments: arguments);
    await _load(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final ongoing = _trips
        .where((trip) => ownerTripIsDashboardOngoing(trip, _boats, now))
        .toList()
      ..sort((a, b) => '${a['scheduledDepartureUtc']}'
          .compareTo('${b['scheduledDepartureUtc']}'));
    final name = _profile?['displayName']?.toString().trim();
    return OwnerLayout(
      active: 'dashboard',
      darkHeader: true,
      child: AnimatedBuilder(
        animation: _gradientController,
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + kToolbarHeight + 18,
            ),
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    OwnerProfileImage(bytes: _profilePhoto, radius: 42),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Welcome Back',
                              style: TextStyle(
                                  fontSize: 11, color: Color(0xFFBFD2E8))),
                          Text(
                            name?.isNotEmpty == true ? name! : 'Boat Owner',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 26),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 100),
                  child: Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                )
              else if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: OwnerErrorPanel(message: _error!, retry: _load),
                )
              else ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: _dashboardNavigationCards(),
                ),
                const SizedBox(height: 22),
                Container(
                  width: double.infinity,
                  constraints: BoxConstraints(
                    minHeight: MediaQuery.sizeOf(context).height * .55,
                  ),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF9FAFC),
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(26)),
                  ),
                  padding: const EdgeInsets.fromLTRB(18, 24, 18, 42),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Ongoing Trips',
                              style: TextStyle(
                                color: ownerInk,
                                fontSize: 21,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () => _open('/owner_trips'),
                            child: const Text('See all'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      if (ongoing.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 20),
                          child: Text(
                            'No ongoing trips right now.',
                            style: TextStyle(color: ownerMuted),
                          ),
                        )
                      else
                        ...ongoing.take(3).map(_tripRow),
                      const SizedBox(height: 26),
                      OwnerEmptyPanel(
                        title: 'Schedule New Trips',
                        message: "Initialize your trip's digital profile.",
                        actionLabel: 'Schedule Trip',
                        icon: Icons.calendar_month_outlined,
                        onAction: () => _open('/owner_new_trip'),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        builder: (context, child) {
          final progress =
              Curves.easeInOut.transform(_gradientController.value);
          return Stack(
            fit: StackFit.expand,
            children: [
              Image.asset(
                'assets/images/bg_whale_boat.jpg',
                fit: BoxFit.cover,
                alignment: Alignment.center,
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment(-1.45 + (progress * 1.15), -1.05),
                    end: Alignment(1.35 - (progress * .85), 1.1),
                    colors: const [
                      Color(0xF201050C),
                      Color(0xE3030D1B),
                      Color(0xCF071B31),
                      Color(0xBD0B2948),
                    ],
                    stops: [
                      0,
                      .24 + (progress * .12),
                      .63 - (progress * .08),
                      1,
                    ],
                    transform: GradientRotation((progress - .5) * .16),
                  ),
                ),
              ),
              if (child != null) child,
            ],
          );
        },
      ),
    );
  }

  Widget _dashboardNavigationCards() => SizedBox(
        height: 244,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: _navigationSurface(
                route: '/owner_boats',
                colors: const [Color(0xFF102CCB), Color(0xFF164BE8)],
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text('My Boats',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700)),
                        ),
                        Text('${_boats.length}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _boats.length == 1
                          ? '1 registered boat'
                          : '${_boats.length} registered boats',
                      style: const TextStyle(
                          color: Color(0xFFD8E5FF), fontSize: 10),
                    ),
                    const SizedBox(height: 9),
                    if (_boats.isEmpty)
                      const Expanded(
                        child: Center(
                          child: Icon(Icons.directions_boat_outlined,
                              color: Colors.white, size: 54),
                        ),
                      )
                    else
                      Expanded(
                        child: Column(
                          children: _boats
                              .take(2)
                              .map((boat) => Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.only(bottom: 6),
                                      child: _miniBoat(boat),
                                    ),
                                  ))
                              .toList(),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                children: [
                  Expanded(
                    child: _statNavigationCard(
                      title: 'My Crew',
                      count: _crew.length,
                      noun: _crew.length == 1 ? 'member' : 'members',
                      icon: Icons.group_outlined,
                      route: '/owner_my_crew',
                      colors: const [Color(0xFF087CF3), Color(0xFF0B5EE8)],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: _statNavigationCard(
                      title: 'My Trips',
                      count: _trips.length,
                      noun: _trips.length == 1 ? 'trip' : 'trips',
                      icon: Icons.sailing_outlined,
                      route: '/owner_trips',
                      colors: const [Color(0xFF05070B), Color(0xFF111927)],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _statNavigationCard({
    required String title,
    required int count,
    required String noun,
    required IconData icon,
    required String route,
    required List<Color> colors,
  }) =>
      _navigationSurface(
        route: route,
        colors: colors,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(title,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 5),
                  Text('$count $noun',
                      style: const TextStyle(
                          color: Color(0xFFD8E5F3), fontSize: 11)),
                ],
              ),
            ),
            Icon(icon, color: Colors.white, size: 42),
          ],
        ),
      );

  Widget _navigationSurface({
    required String route,
    required List<Color> colors,
    required Widget child,
  }) =>
      Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colors),
            borderRadius: BorderRadius.circular(20),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x3D000000),
                  blurRadius: 15,
                  offset: Offset(0, 7)),
            ],
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => _open(route),
            child: Padding(padding: const EdgeInsets.all(12), child: child),
          ),
        ),
      );

  Widget _miniBoat(Map<String, dynamic> boat) => Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(9),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${boat['name'] ?? 'Unnamed boat'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: ownerInk,
                          fontSize: 9,
                          fontWeight: FontWeight.w700)),
                  Text('${boat['registrationNumber'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: ownerMuted, fontSize: 7)),
                  const SizedBox(height: 2),
                  Text('● ${boat['approval'] ?? 'Pending'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: ownerStatusColor(boat['approval']),
                          fontSize: 7,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            const SizedBox(width: 5),
            SizedBox(
                width: 58, child: OwnerBoatImage(boat['imageUrl'], height: 48)),
          ],
        ),
      );

  Widget _tripRow(Map<String, dynamic> trip) => ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 2),
        title: Text(trip['vesselName']?.toString() ?? 'Unnamed vessel',
            style:
                const TextStyle(color: ownerInk, fontWeight: FontWeight.w700)),
        subtitle: Text(trip['registrationNumber']?.toString() ?? '',
            style: const TextStyle(color: ownerMuted, fontSize: 11)),
        trailing: IconButton(
          tooltip: 'View trip',
          color: ownerInk,
          icon: const Icon(Icons.info_outline_rounded),
          onPressed: () =>
              _open('/owner_trip_info', arguments: trip['id']?.toString()),
        ),
      );
}
