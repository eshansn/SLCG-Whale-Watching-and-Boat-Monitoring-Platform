import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../services/api_service.dart';
import '../../widgets/shore_layout.dart';
import 'shore_wildlife_common.dart';

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
  final _monitoringSignature = WildlifeSignatureController();
  final _supervisorSignature = WildlifeSignatureController();
  final _harbourSignature = WildlifeSignatureController();

  Map<String, dynamic>? _trip;
  Map<String, dynamic>? _attendance;
  Map<String, dynamic>? _record;
  bool _loading = true;
  bool _busy = false;
  bool _initialized = false;
  bool _requestInFlight = false;
  String? _error;

  List<TextEditingController> get _controllers => [
        _ticket,
        _tid,
        _monitoringOfficer,
        _supervisor,
        _harbourOfficer,
      ];

  @override
  void initState() {
    super.initState();
    for (final controller in _controllers) {
      controller.addListener(_formChanged);
    }
    for (final signature in [
      _monitoringSignature,
      _supervisorSignature,
      _harbourSignature,
    ]) {
      signature.points.addListener(_formChanged);
    }
  }

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
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final signature in [
      _monitoringSignature,
      _supervisorSignature,
      _harbourSignature,
    ]) {
      signature.dispose();
    }
    super.dispose();
  }

  String get _tripId => _trip!['id'].toString();
  bool get _recordComplete => _record?['status'] == 'Completed';
  bool get _allSignatures => wildlifeSignaturesComplete(_record);
  bool get _monitoringFieldsComplete => [
        _ticket,
        _tid,
        _monitoringOfficer,
        _supervisor,
      ].every((controller) => controller.text.trim().isNotEmpty);
  bool get _signatureFieldsComplete =>
      _harbourOfficer.text.trim().isNotEmpty &&
      !_monitoringSignature.isEmpty &&
      !_supervisorSignature.isEmpty &&
      !_harbourSignature.isEmpty;
  bool get _signaturePhase => wildlifeRecordNeedsSignatures(_record);

  void _formChanged() {
    if (mounted) setState(() {});
  }

  void _handleRealtimeUpdate() => _load(silent: true, loadRecord: false);

  Future<void> _load({bool silent = false, bool loadRecord = true}) async {
    if (_trip == null || _requestInFlight) return;
    _requestInFlight = true;
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final attendance = await _api.shoreWildlifeAttendance(_tripId);
      Map<String, dynamic>? record = _record;
      if (loadRecord) {
        try {
          final records = await _api.shoreWildlifeRecords();
          record = records
              .where((item) => item['tripId']?.toString() == _tripId)
              .firstOrNull;
        } catch (recordError) {
          if (!silent) _error = wildlifeError(recordError);
        }
      }
      if (!mounted) return;
      setState(() {
        _attendance = attendance;
        _record = record;
        _loading = false;
        if (record != null) _fillRecord(record);
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

  void _fillRecord(Map<String, dynamic> record) {
    _ticket.text = record['ticketNumber']?.toString() ?? '';
    _tid.text = record['tidNumber']?.toString() ?? '';
    _monitoringOfficer.text = record['monitoringOfficer']?.toString() ?? '';
    _supervisor.text = record['supervisor']?.toString() ?? '';
    _harbourOfficer.text = record['harbourOfficerName']?.toString() ?? '';
  }

  Map<String, dynamic> _monitoringBody() => {
        'ticketNumber': _ticket.text.trim(),
        'tidNumber': _tid.text.trim(),
        'monitoringOfficer': _monitoringOfficer.text.trim(),
        'supervisor': _supervisor.text.trim(),
      };

  Future<void> _requestSignatures() async {
    if (!_monitoringFieldsComplete) return;
    await _run(() async {
      final body = _monitoringBody();
      _record = await requestWildlifeSignatureWorkflow(
        tripId: _tripId,
        fields: body,
        existingRecord: _record,
        create: _api.createShoreWildlifeRecord,
        update: _api.requestShoreWildlifeSignatures,
      );
      _fillRecord(_record!);
    }, success: 'Monitoring information saved. Add all three signatures.');
  }

  Future<void> _sign() async {
    if (!_signatureFieldsComplete || _record == null) return;
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
        _error = wildlifeError(error);
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
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: WildlifeErrorPanel(
            message: _error ?? 'Trip not found.',
            retry: _load,
          ),
        ),
      );
    }

    final attendance = _attendance!;
    return ShoreLayout(
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
                      WildlifePageHeading(
                        icon: Icons.sailing_outlined,
                        title: attendance['boatName']?.toString() ?? 'Trip',
                        subtitle:
                            '${attendance['registrationNumber'] ?? ''} · ${formatShoreDate(attendance['scheduledDepartureUtc'])}',
                      ),
                      const SizedBox(height: 14),
                      TextButton.icon(
                        onPressed: () => Navigator.pushNamedAndRemoveUntil(
                            context, '/shore_wildlife', (route) => false),
                        icon: const Icon(Icons.arrow_back, size: 18),
                        label: const Text('Trips'),
                        style: TextButton.styleFrom(
                          foregroundColor: shoreIndigo,
                          textStyle:
                              const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (constraints.maxWidth >= 900)
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(children: [
                                _tripInformation(attendance),
                                const SizedBox(height: 20),
                                _attendanceBreakdown(attendance),
                              ]),
                            ),
                            const SizedBox(width: 20),
                            Expanded(child: _monitoringCard(attendance)),
                          ],
                        )
                      else
                        Column(children: [
                          _tripInformation(attendance),
                          const SizedBox(height: 18),
                          _attendanceBreakdown(attendance),
                          const SizedBox(height: 18),
                          _monitoringCard(attendance),
                        ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tripInformation(Map<String, dynamic> attendance) => WildlifeCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader(Icons.info_outline_rounded, 'Trip Information'),
            const SizedBox(height: 16),
            LayoutBuilder(builder: (context, constraints) {
              final items = [
                ('Trip reference', attendance['tripId']),
                ('Boat operator', attendance['ownerName']),
                ('Route', attendance['route']),
                ('Status', attendance['tripStatus']),
              ];
              final width = constraints.maxWidth >= 480
                  ? (constraints.maxWidth - 16) / 2
                  : constraints.maxWidth;
              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: items
                    .map((item) => SizedBox(
                          width: width,
                          child: _info(item.$1, item.$2?.toString() ?? '—'),
                        ))
                    .toList(),
              );
            }),
            const SizedBox(height: 20),
            LayoutBuilder(builder: (context, constraints) {
              final width = (constraints.maxWidth - 16) / 3;
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: width,
                    child: _approval(
                        'Boat approval', wildlifeBoatApproval(attendance)),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: width,
                    child: _approval('SLCG Shore',
                        attendance['shoreApproval']?.toString() ?? 'Pending'),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: width,
                    child: _approval(
                        'Wildlife Shore',
                        attendance['wildlifeShoreApproval']?.toString() ??
                            'Pending'),
                  ),
                ],
              );
            }),
          ],
        ),
      );

  Widget _attendanceBreakdown(Map<String, dynamic> attendance) {
    final local = wildlifeMap(attendance['local']);
    final foreign = wildlifeMap(attendance['foreign']);
    return WildlifeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            runSpacing: 8,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Passenger Attendance',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                  SizedBox(height: 4),
                  Text('● Live Attendance',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF059669))),
                ],
              ),
              Text(
                'Last updated: ${formatShoreDate(attendance['lastUpdatedUtc'])}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          LayoutBuilder(builder: (context, constraints) {
            if (constraints.maxWidth >= 560) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _attendanceGroup('LOCAL', local)),
                  const SizedBox(width: 14),
                  Expanded(child: _attendanceGroup('FOREIGN', foreign)),
                ],
              );
            }
            return Column(children: [
              _attendanceGroup('LOCAL', local),
              const SizedBox(height: 14),
              _attendanceGroup('FOREIGN', foreign),
            ]);
          }),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [wildlifeForest, Color(0xFF1B6B56)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x26123C32),
                  blurRadius: 14,
                  offset: Offset(0, 7),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('TOTAL PRESENT',
                    style: TextStyle(fontSize: 11, color: Colors.white70)),
                const SizedBox(height: 3),
                Text('${attendance['totalPresent'] ?? 0}',
                    style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _monitoringCard(Map<String, dynamic> attendance) => WildlifeCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader(Icons.fact_check_outlined, 'Monitoring Information'),
            const SizedBox(height: 18),
            _field(_ticket, 'Ticket Number', maxLength: 80),
            _field(_tid, 'TID Number', maxLength: 80),
            _field(_monitoringOfficer, 'Monitoring Officer', maxLength: 160),
            _field(_supervisor, 'Supervisor', maxLength: 160),
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_error!,
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFFB91C1C))),
              ),
            if (_signaturePhase) ...[
              const Divider(height: 34),
              const Text('Required Signatures',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              WildlifeSignaturePad(
                label: 'Monitoring Officer — ${_monitoringOfficer.text}',
                controller: _monitoringSignature,
              ),
              WildlifeSignaturePad(
                label: 'Supervisor — ${_supervisor.text}',
                controller: _supervisorSignature,
              ),
              _field(
                _harbourOfficer,
                'Harbour Officer name',
                maxLength: 160,
                alwaysEnabled: true,
              ),
              WildlifeSignaturePad(
                label: 'Harbour Officer',
                controller: _harbourSignature,
              ),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _busy || !_signatureFieldsComplete ? null : _sign,
                  style: FilledButton.styleFrom(
                    backgroundColor: wildlifeGreen,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(
                      _busy ? 'Saving signatures…' : 'Confirm All Signatures'),
                ),
              ),
            ] else
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed:
                      _busy || _recordComplete || !_monitoringFieldsComplete
                          ? null
                          : _requestSignatures,
                  style: FilledButton.styleFrom(
                    backgroundColor: wildlifeForest,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(_busy
                      ? 'Saving…'
                      : _allSignatures
                          ? 'All signatures completed'
                          : 'Request Signatures'),
                ),
              ),
            if (_recordComplete && _allSignatures) ...[
              const Divider(height: 38),
              const Text('Wildlife Shore Approval',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              const Text(
                'All monitoring fields and signatures are complete.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _approve('Rejected'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFB91C1C),
                      side: const BorderSide(color: Color(0xFFFCA5A5)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: const Text('Reject',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ||
                            attendance['wildlifeShoreApproval'] == 'Approved'
                        ? null
                        : () => _approve('Approved'),
                    style: FilledButton.styleFrom(
                      backgroundColor: wildlifeGreen,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                    child: const Text('Approve Trip',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ]),
            ],
            if (_busy)
              const Padding(
                padding: EdgeInsets.only(top: 14),
                child: LinearProgressIndicator(),
              ),
          ],
        ),
      );

  Widget _attendanceGroup(String name, Map<String, dynamic> counts) =>
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: wildlifeCanvas,
          border: Border.all(color: const Color(0xFFDDE9E4)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _count('Adult', counts['adult']),
            _count('Child', counts['child']),
            _count('Small (Under 6 Y)', counts['small']),
            const Divider(height: 22),
            _count('Total', counts['total'], bold: true),
          ],
        ),
      );

  Widget _count(String label, Object? value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Expanded(
              child: Text(label,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: bold ? FontWeight.w600 : FontWeight.w400))),
          Text('${value ?? 0}',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w600)),
        ]),
      );

  Widget _info(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: const TextStyle(fontSize: 11, color: shoreMuted)),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.w600),
              overflow: TextOverflow.visible),
        ],
      );

  Widget _approval(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: shoreInk)),
          const SizedBox(height: 7),
          WildlifeStatusBadge(value),
        ],
      );

  Widget _field(
    TextEditingController controller,
    String label, {
    required int maxLength,
    bool alwaysEnabled = false,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(
          controller: controller,
          enabled: alwaysEnabled || !_recordComplete,
          maxLength: maxLength,
          decoration: InputDecoration(
            labelText: label,
            counterText: '',
            filled: true,
            fillColor: _recordComplete && !alwaysEnabled
                ? const Color(0xFFF1F5F9)
                : const Color(0xFFFBFDFC),
            border: const OutlineInputBorder(
              borderRadius: BorderRadius.all(Radius.circular(10)),
              borderSide: BorderSide(color: Color(0xFFDDE9E4)),
            ),
          ),
        ),
      );

  Widget _sectionHeader(IconData icon, String title) => Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: wildlifeMint,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: wildlifeGreen, size: 20),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      );
}

class WildlifeSignatureController {
  final boundaryKey = GlobalKey();
  final points = ValueNotifier<List<Offset?>>([]);

  bool get isEmpty => points.value.whereType<Offset>().length < 2;

  void add(Offset? point) => points.value = [...points.value, point];
  void clear() => points.value = [];
  void dispose() => points.dispose();

  Future<String> toDataUrl() async {
    final boundary = boundaryKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    if (boundary == null) throw Exception('Signature pad is not ready.');
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) throw Exception('Could not encode signature.');
    final value =
        'data:image/png;base64,${base64Encode(bytes.buffer.asUint8List())}';
    if (value.length > 500000) {
      throw Exception('A signature is too large. Clear it and sign again.');
    }
    return value;
  }
}

class WildlifeSignaturePad extends StatelessWidget {
  const WildlifeSignaturePad({
    super.key,
    required this.label,
    required this.controller,
  });

  final String label;
  final WildlifeSignatureController controller;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(label,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w500)),
              ),
              TextButton(
                onPressed: controller.clear,
                child: const Text('Clear'),
              ),
            ]),
            RepaintBoundary(
              key: controller.boundaryKey,
              child: Container(
                height: 132,
                decoration: BoxDecoration(
                  color: const Color(0xFFFBFDFC),
                  border: Border.all(color: const Color(0xFFC8DDD5)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
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
                          size: Size(constraints.maxWidth, 132),
                          painter: _WildlifeSignaturePainter(points),
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

class _WildlifeSignaturePainter extends CustomPainter {
  const _WildlifeSignaturePainter(this.points);

  final List<Offset?> points;

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
  bool shouldRepaint(covariant _WildlifeSignaturePainter oldDelegate) =>
      oldDelegate.points != points;
}
