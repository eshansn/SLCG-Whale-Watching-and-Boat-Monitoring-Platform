import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_service.dart';
import '../../widgets/mobile_search_field.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';
import 'owner_trip_transfer_sheet.dart';

enum OwnerPassengerSort { name, age, passengerType }

class OwnerTripInfoScreen extends StatefulWidget {
  const OwnerTripInfoScreen({super.key});

  @override
  State<OwnerTripInfoScreen> createState() => _OwnerTripInfoScreenState();
}

class _OwnerTripInfoScreenState extends State<OwnerTripInfoScreen> {
  final _api = ApiService.instance;
  final _search = TextEditingController();
  String? _tripId;
  Map<String, dynamic>? _trip;
  Map<String, dynamic>? _vessel;
  List<Map<String, dynamic>> _passengers = [];
  OwnerPassengerSort _sort = OwnerPassengerSort.name;
  String? _error;
  String? _passengerError;
  String? _mapError;
  String? _transferNotice;
  bool _loading = true;
  bool _starting = false;
  Timer? _passengerTimer;
  Timer? _mapTimer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final value = ModalRoute.of(context)?.settings.arguments;
    if (_tripId == null && value != null) {
      _tripId = value.toString();
      _loadAll();
    }
  }

  @override
  void dispose() {
    _passengerTimer?.cancel();
    _mapTimer?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    if (_tripId == null) return;
    setState(() => _loading = true);
    try {
      final trips = await _api.trips();
      final trip =
          trips.where((item) => '${item['id']}' == _tripId).firstOrNull;
      if (trip == null) throw Exception('Trip not found.');
      if (!mounted) return;
      setState(() {
        _trip = trip;
        _error = null;
        _loading = false;
      });
      await Future.wait([_loadPassengers(), _loadVessel()]);
      _passengerTimer ??=
          Timer.periodic(const Duration(seconds: 5), (_) => _loadPassengers());
      _mapTimer ??=
          Timer.periodic(const Duration(seconds: 10), (_) => _loadVessel());
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = ownerError(error);
        _loading = false;
      });
    }
  }

  Future<void> _loadPassengers() async {
    if (_tripId == null) return;
    try {
      final passengers = await _api.tripPassengers(_tripId!);
      if (!mounted) return;
      setState(() {
        _passengers = passengers;
        _passengerError = null;
      });
    } catch (error) {
      if (mounted) setState(() => _passengerError = ownerError(error));
    }
  }

  Future<void> _loadVessel() async {
    final boatId = '${_trip?['boatId'] ?? ''}';
    if (boatId.isEmpty) return;
    try {
      final vessels = await _api.vesselMap();
      final vessel =
          vessels.where((item) => '${item['id']}' == boatId).firstOrNull;
      if (!mounted) return;
      setState(() {
        _vessel = vessel;
        _mapError = null;
      });
    } catch (error) {
      if (mounted) setState(() => _mapError = ownerError(error));
    }
  }

  String get _invitationUrl {
    final code = '${_trip?['invitationCode'] ?? ''}';
    return code.isEmpty ? '' : '$ownerWebBaseUrl/passenger/trip/$code';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const OwnerLayout(
          active: 'trips',
          title: 'Trip Info',
          child: Center(child: CircularProgressIndicator()));
    }
    if (_trip == null) {
      return OwnerLayout(
        active: 'trips',
        title: 'Trip Info',
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [OwnerErrorPanel(message: _error!, retry: _loadAll)],
        ),
      );
    }

    final query = _search.text.trim().toLowerCase();
    final passengers = _passengers
        .where((passenger) => ownerPassengerMatches(passenger, query))
        .toList();
    passengers.sort((a, b) => compareOwnerPassengers(a, b, _sort.name));
    final isOngoing = '${_trip!['status']}' == 'Ongoing';

    return OwnerLayout(
      active: 'trips',
      title: 'Trip Info',
      child: RefreshIndicator(
        onRefresh: _loadAll,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
          children: [
            _tripSummary,
            if ('${_trip!['status']}' == 'Scheduled' ||
                '${_trip!['status']}' == 'Boarding' ||
                isOngoing) ...[
              const SizedBox(height: 14),
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _starting ? null : _startTrip,
                      icon: _starting
                          ? const SizedBox(
                              width: 17,
                              height: 17,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(isOngoing
                              ? Icons.stop_rounded
                              : Icons.play_arrow_rounded),
                      label: Text(_starting
                          ? (isOngoing ? 'Ending...' : 'Starting...')
                          : (isOngoing ? 'End Trip' : 'Start Trip')),
                    ),
                  ),
                  if (!isOngoing) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _openTransfer,
                        icon: const Icon(Icons.swap_horiz_rounded),
                        label: const Text('Transfer Passengers / Crew'),
                      ),
                    ),
                  ],
                ],
              ),
            ],
            if (_transferNotice != null) ...[
              const SizedBox(height: 10),
              Text(_transferNotice!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Color(0xFF047857), fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 24),
            Row(
              children: [
                const Expanded(
                  child: Text('Passenger Info',
                      style:
                          TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                ),
                OwnerStatusBadge('registered',
                    label: '${_passengers.length} registered'),
              ],
            ),
            const SizedBox(height: 14),
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
                  child: DropdownButton<OwnerPassengerSort>(
                    value: _sort,
                    onChanged: (value) =>
                        setState(() => _sort = value ?? _sort),
                    items: const [
                      DropdownMenuItem(
                          value: OwnerPassengerSort.name, child: Text('Name')),
                      DropdownMenuItem(
                          value: OwnerPassengerSort.age, child: Text('Age')),
                      DropdownMenuItem(
                          value: OwnerPassengerSort.passengerType,
                          child: Text('Type')),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (_passengerError != null)
              OwnerErrorPanel(message: _passengerError!, retry: _loadPassengers)
            else if (passengers.isEmpty)
              OwnerCard(
                child: Text(
                  query.isEmpty
                      ? 'No passengers have registered for this trip yet.'
                      : 'No passengers match your search.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: ownerMuted),
                ),
              )
            else
              ...passengers.map(_passengerCard),
            const SizedBox(height: 16),
            const OwnerCard(
              child: Row(
                children: [
                  Icon(Icons.check_circle_outline_rounded,
                      color: Color(0xFF059669)),
                  SizedBox(width: 10),
                  Text('No Emergencies',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _mapSection,
          ],
        ),
      ),
    );
  }

  Widget get _tripSummary => OwnerCard(
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _value('Boat', _trip!['vesselName']),
                      _value(
                          'Time',
                          DateFormat('h:mm a').format(DateTime.parse(
                                  '${_trip!['scheduledDepartureUtc']}')
                              .toLocal())),
                      _value(
                          'Date',
                          formatOwnerDate(_trip!['scheduledDepartureUtc'],
                              full: true)),
                      OwnerStatusBadge(_trip!['shoreApproval']),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                if (_invitationUrl.isNotEmpty)
                  QrImageView(data: _invitationUrl, size: 132)
                else
                  const SizedBox(
                    width: 132,
                    child: Text('QR invitation unavailable.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: ownerMuted)),
                  ),
              ],
            ),
            if (_invitationUrl.isNotEmpty) ...[
              const SizedBox(height: 14),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: _copyInvitation,
                    icon: const Icon(Icons.copy_rounded, size: 17),
                    label: const Text('Copy link'),
                  ),
                  FilledButton.icon(
                    onPressed: _shareQr,
                    icon: const Icon(Icons.download_rounded, size: 17),
                    label: const Text('Download QR'),
                  ),
                ],
              ),
            ],
          ],
        ),
      );

  Widget _value(String label, Object? value) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    color: ownerMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600)),
            Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
      );

  Widget _passengerCard(Map<String, dynamic> passenger) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: OwnerCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${passenger['name']}',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 9),
              _row('NIC or Passport', passenger['identificationNumber']),
              _row('Age', passenger['ageCategory']),
              _row('Passenger type', passenger['passengerType']),
            ],
          ),
        ),
      );

  Widget _row(String label, Object? value) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Row(
          children: [
            SizedBox(
                width: 125,
                child: Text(label,
                    style: const TextStyle(
                        color: ownerMuted, fontWeight: FontWeight.w600))),
            Expanded(child: Text('${value ?? 'Not provided'}')),
          ],
        ),
      );

  Widget get _mapSection {
    final latitude = ownerDouble(_vessel?['latitude']);
    final longitude = ownerDouble(_vessel?['longitude']);
    return OwnerCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 18, 18, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Live vessel location',
                    style: TextStyle(
                        color: ownerNavy,
                        fontSize: 17,
                        fontWeight: FontWeight.w700)),
                Text('Updates automatically every 10 seconds',
                    style: TextStyle(color: ownerMuted, fontSize: 12)),
              ],
            ),
          ),
          if (_mapError != null)
            Padding(
              padding: const EdgeInsets.all(18),
              child:
                  Text(_mapError!, style: const TextStyle(color: Colors.red)),
            )
          else if (latitude == null || longitude == null)
            const Padding(
              padding: EdgeInsets.fromLTRB(18, 0, 18, 20),
              child: Text('No GPS location received yet.',
                  style: TextStyle(color: ownerMuted)),
            )
          else ...[
            SizedBox(
              height: 330,
              child: FlutterMap(
                options: MapOptions(
                    initialCenter: LatLng(latitude, longitude),
                    initialZoom: 14),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'wwms_app',
                  ),
                  MarkerLayer(markers: [
                    Marker(
                      point: LatLng(latitude, longitude),
                      width: 48,
                      height: 48,
                      child: const CircleAvatar(
                        backgroundColor: ownerNavy,
                        foregroundColor: Colors.white,
                        child: Icon(Icons.navigation_rounded),
                      ),
                    ),
                  ]),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}${_vessel?['coordinatesRecordedAtUtc'] == null ? '' : ' · ${formatOwnerDate(_vessel!['coordinatesRecordedAtUtc'])}'}',
                style: const TextStyle(color: ownerMuted, fontSize: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _copyInvitation() async {
    await Clipboard.setData(ClipboardData(text: _invitationUrl));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invitation link copied.')));
    }
  }

  Future<void> _shareQr() async {
    try {
      final painter = QrPainter.withQr(
        qr: QrCode.fromData(
          data: _invitationUrl,
          errorCorrectLevel: QrErrorCorrectLevel.H,
        ),
        color: const Color(0xFF000000),
        emptyColor: const Color(0xFFFFFFFF),
        gapless: true,
      );
      final data =
          await painter.toImageData(1024, format: ui.ImageByteFormat.png);
      if (data == null) throw Exception('Unable to generate QR image.');
      await SharePlus.instance.share(ShareParams(
        text: 'Passenger trip invitation',
        files: [
          XFile.fromData(data.buffer.asUint8List(),
              mimeType: 'image/png', name: 'trip-invitation.png')
        ],
      ));
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ownerError(error))));
      }
    }
  }

  Future<void> _openTransfer() async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      builder: (_) => OwnerTripTransferSheet(sourceTripId: _tripId!),
    );
    if (result == null || !mounted) return;
    setState(() {
      _transferNotice =
          'Transfer completed successfully. ${result['passengerCount']} passengers and ${result['crewCount']} crew members were transferred.';
    });
    await _loadAll();
  }

  Future<void> _startTrip() async {
    if (_tripId == null || _starting) return;
    final isOngoing = '${_trip?['status']}' == 'Ongoing';
    setState(() => _starting = true);
    try {
      await _api.updateStatus(_tripId!, isOngoing ? 'Completed' : 'Ongoing');
      await _loadAll();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(isOngoing
                ? 'Trip ended successfully.'
                : 'Trip started successfully.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ownerError(error))));
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }
}
