import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../services/api_service.dart';
import '../../widgets/shore_layout.dart';

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
        if (!silent) _error = _message(error);
      });
    }
  }

  List<Map<String, dynamic>> get _visibleTrips {
    final query = _query.trim().toLowerCase();
    final items = _trips.where((trip) {
      if (query.isEmpty) return true;
      return [
        trip['boatName'],
        trip['registrationNumber'],
        trip['ownerName'],
        trip['route'],
      ].any((value) => value.toString().toLowerCase().contains(query));
    }).toList();
    items.sort((left, right) {
      if (_sort == 'name') {
        return left['boatName']
            .toString()
            .compareTo(right['boatName'].toString());
      }
      final leftDate =
          DateTime.tryParse(left['scheduledDepartureUtc'].toString());
      final rightDate =
          DateTime.tryParse(right['scheduledDepartureUtc'].toString());
      final comparison =
          (leftDate ?? DateTime(0)).compareTo(rightDate ?? DateTime(0));
      return _sort == 'oldest' ? comparison : -comparison;
    });
    return items;
  }

  @override
  Widget build(BuildContext context) => ShoreLayout(
        portal: ShorePortal.wildlife,
        active: 'trips',
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              const Text('Wildlife Shore Trips',
                  style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      color: shoreInk)),
              const SizedBox(height: 4),
              const Text(
                'Monitor live attendance and complete Wildlife Shore approval.',
                style: TextStyle(color: shoreMuted),
              ),
              const SizedBox(height: 18),
              TextField(
                onChanged: (value) => setState(() => _query = value),
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search boat, registration, owner, or route',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _sort,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.sort),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'newest', child: Text('Newest')),
                  DropdownMenuItem(value: 'oldest', child: Text('Oldest')),
                  DropdownMenuItem(value: 'name', child: Text('Vessel name')),
                ],
                onChanged: (value) => setState(() => _sort = value ?? 'newest'),
              ),
              const SizedBox(height: 14),
              if (_loading)
                const Padding(
                    padding: EdgeInsets.all(36),
                    child: Center(child: CircularProgressIndicator()))
              else if (_error != null)
                _ErrorPanel(message: _error!, retry: _load)
              else if (_visibleTrips.isEmpty)
                const _EmptyPanel(message: 'No matching trips found.')
              else
                ..._visibleTrips.map(_tripCard),
            ],
          ),
        ),
      );

  Widget _tripCard(Map<String, dynamic> trip) => Card(
        color: Colors.white,
        margin: const EdgeInsets.only(bottom: 12),
        child: ListTile(
          contentPadding: const EdgeInsets.all(14),
          leading: const CircleAvatar(
            backgroundColor: Color(0xFFEEF2FF),
            child: Icon(Icons.directions_boat, color: shoreIndigo),
          ),
          title: Text(trip['boatName']?.toString() ?? 'Unnamed vessel',
              style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              '${trip['registrationNumber'] ?? 'No registration'} · ${trip['ownerName'] ?? 'Unknown owner'}\n'
              'SLCG ${trip['shoreApproval'] ?? 'Pending'} · Wildlife Shore ${trip['wildlifeShoreApproval'] ?? 'Pending'}',
            ),
          ),
          isThreeLine: true,
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.pushNamed(
            context,
            '/shore_wildlife_trip',
            arguments: Map<String, dynamic>.from(trip),
          ),
        ),
      );
}

class ShoreWildlifeTripScreen extends StatefulWidget {
  const ShoreWildlifeTripScreen({super.key});

  @override
  State<ShoreWildlifeTripScreen> createState() =>
      _ShoreWildlifeTripScreenState();
}

class _ShoreWildlifeTripScreenState extends State<ShoreWildlifeTripScreen> {
  final _api = ApiService.instance;
  final _ticket = TextEditingController();
  final _tid = TextEditingController();
  final _monitoringOfficer = TextEditingController();
  final _supervisor = TextEditingController();
  final _harbourOfficer = TextEditingController();
  final _monitoringSignature = SignatureController();
  final _supervisorSignature = SignatureController();
  final _harbourSignature = SignatureController();

  Map<String, dynamic>? _trip;
  Map<String, dynamic>? _attendance;
  Map<String, dynamic>? _record;
  bool _loading = true;
  bool _busy = false;
  bool _initialized = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map) {
      _trip = Map<String, dynamic>.from(arguments);
      _api.addListener(_handleRealtimeUpdate);
      _load();
    } else {
      setState(() {
        _loading = false;
        _error = 'Trip details were not supplied.';
      });
    }
  }

  @override
  void dispose() {
    _api.removeListener(_handleRealtimeUpdate);
    for (final controller in [
      _ticket,
      _tid,
      _monitoringOfficer,
      _supervisor,
      _harbourOfficer,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  String get _tripId => _trip!['id'].toString();
  bool get _recordComplete => _record?['status'] == 'Completed';
  bool get _allSignatures =>
      _present(_record?['monitoringOfficerSignature']) &&
      _present(_record?['supervisorSignature']) &&
      _present(_record?['harbourOfficerSignature']);

  void _handleRealtimeUpdate() => _load(silent: true);

  Future<void> _load({bool silent = false}) async {
    if (_trip == null) return;
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.shoreWildlifeAttendance(_tripId),
        _api.shoreWildlifeRecords(),
      ]);
      final attendance = results[0] as Map<String, dynamic>;
      final records = results[1] as List<Map<String, dynamic>>;
      Map<String, dynamic>? record;
      for (final item in records) {
        if (item['tripId'].toString() == _tripId) {
          record = item;
          break;
        }
      }
      if (!mounted) return;
      setState(() {
        _attendance = attendance;
        _record = record;
        _loading = false;
        _error = null;
        if (record != null) _fillRecord(record);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (!silent) _error = _message(error);
      });
    }
  }

  void _fillRecord(Map<String, dynamic> record) {
    _ticket.text = record['ticketNumber']?.toString() ?? '';
    _tid.text = record['tidNumber']?.toString() ?? '';
    _monitoringOfficer.text = record['monitoringOfficer']?.toString() ?? '';
    _supervisor.text = record['supervisor']?.toString() ?? '';
    _harbourOfficer.text = record['harbourOfficerName']?.toString() ?? '';
  }

  bool _validateMonitoringFields({bool includeHarbour = false}) {
    final missing = <String>[];
    if (_ticket.text.trim().isEmpty) missing.add('Ticket Number');
    if (_tid.text.trim().isEmpty) missing.add('TID Number');
    if (_monitoringOfficer.text.trim().isEmpty)
      missing.add('Monitoring Officer');
    if (_supervisor.text.trim().isEmpty) missing.add('Supervisor');
    if (includeHarbour && _harbourOfficer.text.trim().isEmpty) {
      missing.add('Harbour Officer Name');
    }
    if (missing.isEmpty) return true;
    setState(() => _error = 'Complete: ${missing.join(', ')}.');
    return false;
  }

  Future<void> _requestSignatures() async {
    if (!_validateMonitoringFields()) return;
    await _run(() async {
      final body = _monitoringBody();
      _record = _record == null
          ? await _api.createShoreWildlifeRecord({'tripId': _tripId, ...body})
          : await _api.requestShoreWildlifeSignatures(
              _record!['id'].toString(), body);
      _fillRecord(_record!);
    }, success: 'Monitoring information saved. Add all three signatures.');
  }

  Map<String, dynamic> _monitoringBody() => {
        'ticketNumber': _ticket.text.trim(),
        'tidNumber': _tid.text.trim(),
        'monitoringOfficer': _monitoringOfficer.text.trim(),
        'supervisor': _supervisor.text.trim(),
      };

  Future<void> _sign() async {
    if (!_validateMonitoringFields(includeHarbour: true)) return;
    if (_record == null) {
      setState(() => _error = 'Save the monitoring information first.');
      return;
    }
    if (_monitoringSignature.isEmpty ||
        _supervisorSignature.isEmpty ||
        _harbourSignature.isEmpty) {
      setState(() => _error = 'All three signatures are required.');
      return;
    }
    await _run(() async {
      _record = await _api.signShoreWildlifeRecord(
        _record!['id'].toString(),
        {
          'harbourOfficerName': _harbourOfficer.text.trim(),
          'monitoringOfficerSignature': await _monitoringSignature.toDataUrl(),
          'supervisorSignature': await _supervisorSignature.toDataUrl(),
          'harbourOfficerSignature': await _harbourSignature.toDataUrl(),
        },
      );
      _fillRecord(_record!);
    }, success: 'All signatures were saved.');
  }

  Future<void> _approve(String approval) async {
    if (approval == 'Approved' && (!_recordComplete || !_allSignatures)) {
      setState(() => _error =
          'Complete all monitoring information and all three signatures before approval.');
      return;
    }
    await _run(() async {
      final updated = await _api.approveShoreWildlifeTrip(_tripId, approval);
      _trip = {...?_trip, ...updated};
      _attendance = {...?_attendance, ...updated};
    }, success: 'Trip ${approval.toLowerCase()}.');
  }

  Future<void> _run(Future<void> Function() action,
      {required String success}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(success)));
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _message(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const ShoreLayout(
        portal: ShorePortal.wildlife,
        active: 'trips',
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_attendance == null) {
      return ShoreLayout(
        portal: ShorePortal.wildlife,
        active: 'trips',
        child: _ErrorPanel(message: _error ?? 'Trip not found.', retry: _load),
      );
    }
    final attendance = _attendance!;
    final local = _map(attendance['local']);
    final foreign = _map(attendance['foreign']);
    final boatApproved = attendance['certificationApproval'] == 'Approved' ||
        attendance['boatWildlifeApproval'] == 'Approved';

    return ShoreLayout(
      portal: ShorePortal.wildlife,
      active: 'trips',
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Text(attendance['boatName']?.toString() ?? 'Trip',
                style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: shoreInk)),
            Text(
              '${attendance['registrationNumber'] ?? ''} · ${attendance['route'] ?? ''}',
              style: const TextStyle(color: shoreMuted),
            ),
            const SizedBox(height: 14),
            _section('Approvals', [
              _valueRow('Boat approval', boatApproved ? 'Approved' : 'Pending'),
              _valueRow('SLCG Shore', attendance['shoreApproval'] ?? 'Pending'),
              _valueRow('Wildlife Shore',
                  attendance['wildlifeShoreApproval'] ?? 'Pending'),
            ]),
            _section('Live Attendance', [
              _valueRow('Local Adult', local['adult'] ?? 0),
              _valueRow('Local Child', local['child'] ?? 0),
              _valueRow('Local Small', local['small'] ?? 0),
              _valueRow('Foreign Adult', foreign['adult'] ?? 0),
              _valueRow('Foreign Child', foreign['child'] ?? 0),
              _valueRow('Foreign Small', foreign['small'] ?? 0),
              const Divider(),
              _valueRow('Total Present', attendance['totalPresent'] ?? 0),
            ]),
            _section('Monitoring Information', [
              _field(_ticket, 'Ticket Number', readOnly: _recordComplete),
              _field(_tid, 'TID Number', readOnly: _recordComplete),
              _field(_monitoringOfficer, 'Monitoring Officer',
                  readOnly: _recordComplete),
              _field(_supervisor, 'Supervisor', readOnly: _recordComplete),
              if (_record == null || !_recordComplete)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _requestSignatures,
                    icon: const Icon(Icons.draw_outlined),
                    label: const Text('Request Signatures'),
                  ),
                ),
              if (_record != null && (!_recordComplete || !_allSignatures)) ...[
                SignaturePad(
                    label: 'Monitoring Officer — ${_monitoringOfficer.text}',
                    controller: _monitoringSignature),
                SignaturePad(
                    label: 'Supervisor — ${_supervisor.text}',
                    controller: _supervisorSignature),
                _field(_harbourOfficer, 'Harbour Officer Name'),
                SignaturePad(
                    label: 'Harbour Officer', controller: _harbourSignature),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _sign,
                    icon: const Icon(Icons.verified_outlined),
                    label: const Text('Confirm All Signatures'),
                  ),
                ),
              ],
              if (_recordComplete && _allSignatures) ...[
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.verified, color: Colors.green),
                  title: Text('All signatures completed'),
                ),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _approve('Rejected'),
                      icon: const Icon(Icons.close),
                      label: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _busy || !boatApproved
                          ? null
                          : () => _approve('Approved'),
                      icon: const Icon(Icons.check),
                      label: const Text('Approve Trip'),
                    ),
                  ),
                ]),
                if (!boatApproved)
                  const Padding(
                    padding: EdgeInsets.only(top: 10),
                    child: Text(
                      'The boat must first be approved by Admin or the main Wildlife portal.',
                      style: TextStyle(color: Colors.orange),
                    ),
                  ),
              ],
              if (_busy)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: LinearProgressIndicator(),
                ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child:
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) => Card(
        color: Colors.white,
        margin: const EdgeInsets.only(bottom: 14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              ...children,
            ],
          ),
        ),
      );

  Widget _valueRow(String label, Object value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
                child: Text(label, style: const TextStyle(color: shoreMuted))),
            Text(value.toString(),
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
        ),
      );

  Widget _field(TextEditingController controller, String label,
          {bool readOnly = false}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: controller,
          readOnly: readOnly,
          decoration: InputDecoration(
            labelText: label,
            filled: readOnly,
            fillColor: readOnly ? const Color(0xFFF1F5F9) : null,
            border: const OutlineInputBorder(),
          ),
        ),
      );
}

class SignatureController {
  final GlobalKey boundaryKey = GlobalKey();
  final ValueNotifier<List<Offset?>> points = ValueNotifier([]);

  bool get isEmpty => points.value.whereType<Offset>().length < 2;

  void add(Offset? point) => points.value = [...points.value, point];
  void clear() => points.value = [];

  Future<String> toDataUrl() async {
    final boundary = boundaryKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    if (boundary == null) throw Exception('Signature pad is not ready.');
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) throw Exception('Could not encode signature.');
    return 'data:image/png;base64,${base64Encode(bytes.buffer.asUint8List())}';
  }
}

class SignaturePad extends StatelessWidget {
  final String label;
  final SignatureController controller;

  const SignaturePad({
    super.key,
    required this.label,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                    child: Text(label,
                        style: const TextStyle(fontWeight: FontWeight.w600))),
                IconButton(
                  tooltip: 'Clear signature',
                  onPressed: controller.clear,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            RepaintBoundary(
              key: controller.boundaryKey,
              child: Container(
                height: 150,
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LayoutBuilder(
                    builder: (context, constraints) => GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onPanStart: (details) =>
                          controller.add(details.localPosition),
                      onPanUpdate: (details) =>
                          controller.add(details.localPosition),
                      onPanEnd: (_) => controller.add(null),
                      child: ValueListenableBuilder<List<Offset?>>(
                        valueListenable: controller.points,
                        builder: (context, points, _) => CustomPaint(
                          size: Size(constraints.maxWidth, 150),
                          painter: _SignaturePainter(points),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
}

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  const _SignaturePainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = shoreInk
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    for (var index = 0; index < points.length - 1; index++) {
      final start = points[index];
      final end = points[index + 1];
      if (start != null && end != null) canvas.drawLine(start, end, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) =>
      oldDelegate.points != points;
}

class _ErrorPanel extends StatelessWidget {
  final String message;
  final Future<void> Function() retry;
  const _ErrorPanel({required this.message, required this.retry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 40),
              const SizedBox(height: 10),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: retry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
}

class _EmptyPanel extends StatelessWidget {
  final String message;
  const _EmptyPanel({required this.message});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(36),
        child: Center(
            child: Text(message, style: const TextStyle(color: shoreMuted))),
      );
}

Map<String, dynamic> _map(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

bool _present(Object? value) => value != null && value.toString().isNotEmpty;

String _message(Object error) =>
    error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
