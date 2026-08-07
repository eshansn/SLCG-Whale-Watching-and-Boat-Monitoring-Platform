import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/mobile_search_field.dart';
import '../../widgets/shore_layout.dart';
import 'passenger_attendance_panel.dart';

class TripDetailsScreen extends StatefulWidget {
  const TripDetailsScreen({super.key});

  @override
  State<TripDetailsScreen> createState() => _TripDetailsScreenState();
}

class _TripDetailsScreenState extends State<TripDetailsScreen> {
  Map<String, dynamic> trip = {};
  Map<String, dynamic>? boat;
  String crewSearch = '';
  bool loading = true;
  bool deciding = false;
  String? error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (trip.isEmpty) {
      trip = (ModalRoute.of(context)?.settings.arguments
              as Map<String, dynamic>?) ??
          {};
      _load();
      ApiService.instance.addListener(_refreshFromRealtime);
    }
  }

  @override
  void dispose() {
    ApiService.instance.removeListener(_refreshFromRealtime);
    super.dispose();
  }

  void _refreshFromRealtime() => unawaited(_load(silent: true));

  Future<void> _load({bool silent = false}) async {
    final id = trip['id']?.toString();
    if (id == null) return;
    if (!silent && mounted) setState(() => loading = true);
    try {
      final results = await Future.wait([
        ApiService.instance.trips(),
        ApiService.instance.boats(),
      ]);
      final latest = results[0]
          .where((record) => record['id']?.toString() == id)
          .firstOrNull;
      final latestBoat = results[1]
          .where((record) =>
              record['id']?.toString() == latest?['boatId']?.toString())
          .firstOrNull;
      if (!mounted) return;
      setState(() {
        if (latest != null) {
          trip
            ..['vessel'] = latest['vesselName']
            ..['owner'] = latest['ownerName']
            ..['reg'] = latest['registrationNumber']
            ..['time'] = formatShoreDate(latest['scheduledDepartureUtc'])
            ..['status'] = latest['shoreApproval']
            ..['crew'] = latest['crew'] ?? const []
            ..['raw'] = latest;
        }
        boat = latestBoat;
        loading = false;
        error = null;
      });
    } catch (loadError) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = _message(loadError);
      });
    }
  }

  Map<String, dynamic> get raw =>
      ((trip['raw'] as Map?) ?? const {}).cast<String, dynamic>();

  List<Map<String, dynamic>> get crew => ((trip['crew'] as List?) ?? const [])
      .whereType<Map>()
      .map((item) => item.cast<String, dynamic>())
      .toList();

  List<Map<String, dynamic>> get visibleCrew {
    final query = crewSearch.trim().toLowerCase();
    if (query.isEmpty) return crew;
    return crew
        .where((member) => [
              member['name'],
              member['nicNumber'],
              member['position'],
              member['certified'] == true ? 'Yes' : 'No'
            ].any((value) =>
                value?.toString().toLowerCase().contains(query) ?? false))
        .toList();
  }

  @override
  Widget build(BuildContext context) => ShoreLayout(
        active: 'trips',
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: EdgeInsets.symmetric(
                horizontal: constraints.maxWidth >= 1100
                    ? 32
                    : constraints.maxWidth >= 700
                        ? 22
                        : 12,
                vertical: constraints.maxWidth >= 700 ? 24 : 14),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1280),
                child: Column(children: [
                  _pageHeading(),
                  const SizedBox(height: 20),
                  if (error != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10)),
                      child: Text(error!,
                          style: const TextStyle(color: Color(0xFFB91C1C))),
                    ),
                    const SizedBox(height: 20),
                  ],
                  if (loading && raw.isEmpty)
                    const Padding(
                        padding: EdgeInsets.all(60),
                        child: CircularProgressIndicator())
                  else if (constraints.maxWidth >= 1050)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 320, child: _vesselCard()),
                        const SizedBox(width: 20),
                        Expanded(child: _tripContent())
                      ],
                    )
                  else
                    Column(children: [
                      _vesselCard(),
                      const SizedBox(height: 20),
                      _tripContent()
                    ])
                ]),
              ),
            ),
          ),
        ),
      );

  Widget _pageHeading() => Row(children: [
        IconButton.outlined(
            tooltip: 'Back to trips',
            onPressed: () =>
                Navigator.pushReplacementNamed(context, '/trips_list'),
            icon: const Icon(Icons.arrow_back, size: 18)),
        const SizedBox(width: 12),
        const Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Trip Details',
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w600, color: shoreInk)),
          SizedBox(height: 3),
          Text('Review passenger attendance, crew, and shore approval.',
              style: TextStyle(fontSize: 12, color: shoreMuted))
        ]))
      ]);

  Widget _vesselCard() => Container(
        width: double.infinity,
        decoration: _cardDecoration(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Image.asset(
              'assets/images/fv_mirissa_king.jpg',
              height: 208,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                height: 208,
                color: const Color(0xFFCBD5E1),
                child: const Center(
                    child: Icon(Icons.directions_boat,
                        size: 72, color: Colors.white)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(trip['vessel']?.toString() ?? 'Vessel',
                  style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      color: shoreInk)),
              const SizedBox(height: 4),
              Text(trip['reg']?.toString() ?? '',
                  style: const TextStyle(fontSize: 12, color: shoreMuted)),
              const SizedBox(height: 24),
              Wrap(runSpacing: 16, children: [
                _detail('Owner', trip['owner']?.toString() ?? ''),
                _detail(
                    'Departure', formatShoreDate(raw['scheduledDepartureUtc'])),
                _detail('Length', '${_number(boat?['lengthMeters'])} M'),
                _detail('Capacity', '${_capacity()} Passengers'),
                _detail('Passengers', '${raw['passengerCount'] ?? 0}'),
                _detail('Status', trip['status']?.toString() ?? 'Pending'),
              ])
            ]),
          )
        ]),
      );

  Widget _detail(String label, String value) => SizedBox(
        width: 135,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: shoreMuted)),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w500, color: shoreInk))
        ]),
      );

  Widget _tripContent() => Column(children: [
        PassengerAttendancePanel(tripId: trip['id'].toString()),
        const SizedBox(height: 20),
        LayoutBuilder(builder: (context, constraints) {
          if (constraints.maxWidth >= 760) {
            return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: _crewCard()),
              const SizedBox(width: 20),
              SizedBox(width: 250, child: _approvalCard())
            ]);
          }
          return Column(children: [
            _crewCard(),
            const SizedBox(height: 20),
            _approvalCard()
          ]);
        })
      ]);

  Widget _crewCard() => Container(
        width: double.infinity,
        decoration: _cardDecoration(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: LayoutBuilder(builder: (context, constraints) {
              final title = Text('Crew (${crew.length})',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: shoreInk));
              final search = SizedBox(
                width: constraints.maxWidth >= 420 ? 160 : double.infinity,
                child: TextField(
                  onChanged: (value) => setState(() => crewSearch = value),
                  style: mobileSearchTextStyle,
                  decoration: mobileSearchDecoration('Search'),
                ),
              );
              return constraints.maxWidth >= 420
                  ? Row(children: [Expanded(child: title), search])
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [title, const SizedBox(height: 12), search]);
            }),
          ),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          if (visibleCrew.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Text(
                    crewSearch.trim().isEmpty
                        ? 'No crew assigned to this trip.'
                        : 'No matching records.',
                    style: const TextStyle(fontSize: 12, color: shoreMuted)),
              ),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowColor:
                    WidgetStateProperty.all(const Color(0xFFF8FAFC)),
                headingTextStyle: const TextStyle(
                    fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                columns: const [
                  DataColumn(label: Text('Name')),
                  DataColumn(label: Text('NIC')),
                  DataColumn(label: Text('Role')),
                  DataColumn(label: Text('Certified')),
                ],
                rows: visibleCrew
                    .map((member) => DataRow(cells: [
                          DataCell(Text(member['name']?.toString() ?? '')),
                          DataCell(Text(
                              member['nicNumber']?.toString().isNotEmpty == true
                                  ? member['nicNumber'].toString()
                                  : 'Not provided')),
                          DataCell(Text(
                              member['position']?.toString() ?? 'Crew Member')),
                          DataCell(
                              Text(member['certified'] == true ? 'Yes' : 'No')),
                        ]))
                    .toList(),
              ),
            )
        ]),
      );

  Widget _approvalCard() => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: _cardDecoration(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Approval',
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w600, color: shoreInk)),
          const SizedBox(height: 12),
          const Text(
              'Inspection completed. The information entered in the system has been verified against the actual vessel and all safety requirements, including passenger capacity and life jacket availability.',
              style: TextStyle(
                  fontSize: 12, height: 1.6, color: Color(0xFF64748B))),
          const SizedBox(height: 24),
          SizedBox(
              width: double.infinity,
              child: FilledButton(
                  onPressed: deciding ? null : () => _decide(true),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: const Text('Approve',
                      style: TextStyle(fontWeight: FontWeight.w600)))),
          const SizedBox(height: 12),
          SizedBox(
              width: double.infinity,
              child: FilledButton(
                  onPressed: deciding ? null : () => _decide(false),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: const Text('Decline',
                      style: TextStyle(fontWeight: FontWeight.w600))))
        ]),
      );

  Future<void> _decide(bool approved) async {
    final id = trip['id']?.toString();
    if (id == null) return;
    setState(() => deciding = true);
    try {
      await ApiService.instance.approve(id, approved ? 'Approved' : 'Rejected');
      if (!mounted) return;
      setState(() => trip['status'] = approved ? 'Approved' : 'Rejected');
      await _decisionDialog(approved);
      await _load(silent: true);
    } catch (decisionError) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_message(decisionError))));
      }
    } finally {
      if (mounted) setState(() => deciding = false);
    }
  }

  Future<void> _decisionDialog(bool approved) => showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          icon: CircleAvatar(
            backgroundColor:
                approved ? const Color(0xFF10B981) : const Color(0xFFEF4444),
            child: Icon(approved ? Icons.check : Icons.priority_high,
                color: Colors.white),
          ),
          title: Text(approved
              ? 'Ride Successfully Authorized'
              : 'Ride Not Authorized'),
          content: Text(approved
              ? 'Authorization has been completed successfully. All required checks have been verified.'
              : 'The authorization request has been declined. The applicant must resolve the identified issues before submitting a new request.'),
          actions: [
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(dialogContext),
                style: FilledButton.styleFrom(
                    backgroundColor: approved
                        ? const Color(0xFF10B981)
                        : const Color(0xFFEF4444)),
                child: const Text('Continue'),
              ),
            )
          ],
        ),
      );

  BoxDecoration _cardDecoration() => BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Color(0x0D0F172A), blurRadius: 14)],
      );

  int _capacity() => boat?['maximumCapacity'] is int
      ? boat!['maximumCapacity'] as int
      : int.tryParse(boat?['maximumCapacity']?.toString() ?? '') ??
          int.tryParse(raw['passengerCount']?.toString() ?? '') ??
          0;

  String _number(Object? value) {
    final number = value is num ? value : num.tryParse(value?.toString() ?? '');
    if (number == null) return '0';
    return number == number.roundToDouble()
        ? number.toInt().toString()
        : number.toStringAsFixed(1);
  }

  static String _message(Object value) =>
      value.toString().replaceFirst('Exception: ', '');
}
