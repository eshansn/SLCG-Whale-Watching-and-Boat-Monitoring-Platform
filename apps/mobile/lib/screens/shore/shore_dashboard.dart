import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/shore_layout.dart';

class ShoreDashboard extends StatefulWidget {
  const ShoreDashboard({super.key});
  @override
  State<ShoreDashboard> createState() => _State();
}

class _State extends State<ShoreDashboard> {
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
      child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                  horizontal: constraints.maxWidth > 900 ? 32 : 20,
                  vertical: constraints.maxWidth >= 900
                      ? 32
                      : constraints.maxWidth >= 600
                          ? 24
                          : 16),
              child: ConstrainedBox(
                  constraints: BoxConstraints(
                      minHeight: constraints.maxHeight -
                          (constraints.maxWidth >= 900
                              ? 64
                              : constraints.maxWidth >= 600
                                  ? 48
                                  : 32)),
                  child: Center(
                      child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 1152),
                          child: constraints.maxWidth >= 900
                              ? Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                      SizedBox(width: 180, child: _welcome()),
                                      const SizedBox(width: 32),
                                      Expanded(child: _cards())
                                    ])
                              : Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                      _welcome(),
                                      const SizedBox(height: 28),
                                      _cards()
                                    ])))))));
  Widget _welcome() {
    final pending = trips.where((t) => t['shoreApproval'] == 'Pending').length;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Hello,',
          style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Color(0xFF334155))),
      const SizedBox(height: 4),
      const Text('Shore Officer!',
          style: TextStyle(
              fontSize: 28, fontWeight: FontWeight.w600, color: shoreInk)),
      const SizedBox(height: 8),
      const Text('Stay in Control, Stay Connected',
          style: TextStyle(fontSize: 12, color: shoreMuted)),
      const SizedBox(height: 32),
      Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              boxShadow: const [
                BoxShadow(color: Color(0x0D0F172A), blurRadius: 12)
              ]),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text("What's\nNew?",
                style: TextStyle(
                    fontSize: 18,
                    height: 1.3,
                    fontWeight: FontWeight.w500,
                    color: shoreInk)),
            const SizedBox(height: 20),
            Text('${pending.toString().padLeft(2, '0')} Current Trips',
                style: const TextStyle(fontSize: 12, color: shoreMuted)),
            const SizedBox(height: 8),
            Text('$pending Notifications',
                style: const TextStyle(fontSize: 12, color: shoreIndigo))
          ]))
    ]);
  }

  Widget _cards() => LayoutBuilder(
      builder: (context, c) => c.maxWidth >= 600
          ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: _tripsCard()),
              const SizedBox(width: 24),
              Expanded(child: _upcomingCard())
            ])
          : Column(children: [
              _tripsCard(),
              const SizedBox(height: 24),
              _upcomingCard()
            ]));
  Widget _tripsCard() => InkWell(
      onTap: () => Navigator.pushNamed(context, '/trips_list'),
      borderRadius: BorderRadius.circular(6),
      child: Container(
          height: 340,
          width: double.infinity,
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              boxShadow: const [
                BoxShadow(color: Color(0x0D0F172A), blurRadius: 14)
              ]),
          child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DecoratedBox(
                    decoration: BoxDecoration(
                        color: Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.all(Radius.circular(12))),
                    child: Padding(
                        padding: EdgeInsets.all(14),
                        child: Icon(Icons.directions_boat_outlined,
                            size: 38, color: shoreIndigo))),
                SizedBox(height: 28),
                Text('Trips',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w500,
                        color: shoreInk)),
                SizedBox(height: 16),
                Text(
                    'Access all upcoming and completed trips requiring shore review.',
                    style: TextStyle(
                        fontSize: 14, height: 1.55, color: shoreMuted)),
                Spacer(),
                Text('View »',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: shoreIndigo))
              ])));
  Widget _upcomingCard() => Container(
      height: 340,
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(6),
          boxShadow: const [
            BoxShadow(color: Color(0x0D0F172A), blurRadius: 14)
          ]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Upcoming Trips',
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.w500, color: shoreInk)),
        const SizedBox(height: 8),
        const Text('Upcoming trip records.',
            style: TextStyle(fontSize: 12, color: shoreMuted)),
        const SizedBox(height: 18),
        if (loading)
          const Expanded(child: Center(child: CircularProgressIndicator()))
        else if (error != null)
          Expanded(
              child: Center(
                  child:
                      Text(error!, style: const TextStyle(color: Colors.red))))
        else
          Expanded(
              child: ListView.separated(
                  itemCount: trips.take(3).length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final t = trips[index];
                    return InkWell(
                        onTap: () => Navigator.pushNamed(
                            context, '/trip_details', arguments: _args(t)),
                        child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                                color: const Color(0xFFF5F7FF),
                                borderRadius: BorderRadius.circular(12)),
                            child: Row(children: [
                              Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8)),
                                  child: const Icon(
                                      Icons.directions_boat_outlined,
                                      color: shoreIndigo)),
                              const SizedBox(width: 12),
                              Expanded(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                    Text(t['vesselName']?.toString() ?? '',
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: shoreInk)),
                                    const SizedBox(height: 4),
                                    Text(
                                        formatShoreDate(
                                            t['scheduledDepartureUtc']),
                                        style: const TextStyle(
                                            fontSize: 10,
                                            color: Color(0xFF64748B)))
                                  ])),
                              Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 5),
                                  decoration: BoxDecoration(
                                      color: Colors.white,
                                      border: Border.all(
                                          color: const Color(0xFFA5B4FC)),
                                      borderRadius: BorderRadius.circular(20)),
                                  child: const Text('Info',
                                      style: TextStyle(
                                          fontSize: 9, color: shoreIndigo)))
                            ])));
                  }))
      ]));
}
