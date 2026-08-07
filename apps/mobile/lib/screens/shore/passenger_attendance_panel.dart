import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../services/api_service.dart';
import '../../widgets/mobile_search_field.dart';
import '../../widgets/shore_layout.dart';

class PassengerAttendancePanel extends StatefulWidget {
  const PassengerAttendancePanel({super.key, required this.tripId});

  final String tripId;

  @override
  State<PassengerAttendancePanel> createState() =>
      _PassengerAttendancePanelState();
}

class _PassengerAttendancePanelState extends State<PassengerAttendancePanel> {
  final _searchController = TextEditingController();
  Map<String, dynamic>? _manifest;
  Map<String, dynamic>? _group;
  List<Map<String, dynamic>> _results = [];
  final Map<String, String> _statuses = {};
  Timer? _searchTimer;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    ApiService.instance.addListener(_refreshFromRealtime);
  }

  @override
  void didUpdateWidget(covariant PassengerAttendancePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tripId != widget.tripId) {
      _manifest = null;
      _group = null;
      _statuses.clear();
      _load();
    }
  }

  @override
  void dispose() {
    _searchTimer?.cancel();
    _searchController.dispose();
    ApiService.instance.removeListener(_refreshFromRealtime);
    super.dispose();
  }

  void _refreshFromRealtime() => unawaited(_load(silent: true));

  Future<void> _load({bool silent = false}) async {
    if (!silent && _manifest == null && mounted) {
      setState(() => _loading = true);
    }
    try {
      final manifest = await ApiService.instance.shoreAttendance(widget.tripId);
      if (!mounted) return;
      setState(() {
        _manifest = manifest;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _message(error);
      });
    }
  }

  void _queueSearch(String value) {
    _searchTimer?.cancel();
    final query = value.trim();
    if (query.length < 2) {
      setState(() => _results = []);
      return;
    }
    _searchTimer = Timer(const Duration(milliseconds: 300), () async {
      try {
        final results = await ApiService.instance
            .searchShorePassengerGroups(widget.tripId, query);
        if (mounted && _searchController.text.trim() == query) {
          setState(() => _results = results);
        }
      } catch (_) {
        if (mounted) setState(() => _results = []);
      }
    });
  }

  Future<void> _openSearch(String primaryId) async {
    try {
      _openGroup(await ApiService.instance
          .shorePassengerGroup(widget.tripId, primaryId));
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    }
  }

  Future<void> _scan(String value) async {
    try {
      _openGroup(
          await ApiService.instance.scanShorePassenger(widget.tripId, value));
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    }
  }

  void _openGroup(Map<String, dynamic> value) {
    final members = _maps(value['members']);
    if (!mounted) return;
    setState(() {
      _group = value;
      _statuses
        ..clear()
        ..addEntries(members.map((member) => MapEntry(
            member['passengerId']?.toString() ?? '',
            member['status']?.toString() ?? 'NotChecked')));
      _results = [];
      _searchController.clear();
      _error = null;
    });
  }

  Future<void> _showScanner() async {
    final value = await showDialog<String>(
        context: context, builder: (_) => const _QrScannerDialog());
    if (value != null && value.trim().isNotEmpty) await _scan(value.trim());
  }

  Future<void> _reviewGroup() async {
    final group = _group;
    if (group == null) return;
    final selected = _statuses.values;
    final present = selected.where((value) => value == 'Present').length;
    final absent = selected.where((value) => value == 'NotPresent').length;
    final unchecked = selected.where((value) => value == 'NotChecked').length;
    final confirmed = await _confirm(
      title: 'Confirm Group Attendance',
      text:
          '$present passengers marked Present · $absent marked Not Present.${unchecked > 0 ? ' $unchecked have not been checked yet.' : ''}',
      warning: unchecked > 0
          ? '$unchecked passengers remain Not Yet Checked. Are you sure you want to continue?'
          : null,
    );
    if (confirmed) await _saveGroup();
  }

  Future<void> _saveGroup() async {
    final group = _group;
    if (group == null) return;
    setState(() => _busy = true);
    try {
      final members = _maps(group['members']);
      final updated = await ApiService.instance.saveShorePassengerGroup(
          widget.tripId,
          group['primaryPassengerId'].toString(),
          members
              .map((member) => {
                    'passengerId': member['passengerId'],
                    'status': _statuses[member['passengerId']?.toString()] ??
                        'NotChecked'
                  })
              .toList());
      _openGroup(updated);
      await _load(silent: true);
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reviewFinalize() async {
    final summary = _summary;
    final unchecked = _int(summary['notChecked']);
    final confirmed = await _confirm(
      title: 'Complete Passenger Verification',
      text:
          '${_int(summary['present'])} Present · ${_int(summary['notPresent'])} Not Present · $unchecked Not Yet Checked · ${_int(summary['total'])} Total',
      warning: unchecked > 0
          ? '$unchecked passengers have not been checked. Finalize anyway?'
          : 'The manifest will be locked after finalization.',
    );
    if (confirmed) await _finalize();
  }

  Future<void> _finalize() async {
    setState(() => _busy = true);
    try {
      final unchecked = _int(_summary['notChecked']);
      final manifest = await ApiService.instance
          .finalizeShoreAttendance(widget.tripId, unchecked > 0);
      if (!mounted) return;
      setState(() {
        _manifest = manifest;
        _group = null;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = _message(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(
      {required String title, required String text, String? warning}) async {
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text(title),
            content: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(text),
              if (warning != null) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(warning,
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF92400E))),
                )
              ]
            ]),
            actions: [
              OutlinedButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Go Back')),
              FilledButton(
                  onPressed: () => Navigator.pop(dialogContext, true),
                  style: FilledButton.styleFrom(backgroundColor: shoreIndigo),
                  child: const Text('Confirm & Save'))
            ],
          ),
        ) ??
        false;
  }

  Map<String, dynamic> get _summary =>
      ((_manifest?['summary'] as Map?) ?? const {}).cast<String, dynamic>();

  bool get _finalized => _manifest?['finalizedAtUtc'] != null;

  @override
  Widget build(BuildContext context) {
    if (_loading && _manifest == null) {
      return _card(const Padding(
          padding: EdgeInsets.all(24),
          child: Row(children: [
            SizedBox(width: 20, height: 20, child: CircularProgressIndicator()),
            SizedBox(width: 12),
            Text('Loading passenger attendance...')
          ])));
    }
    return Column(children: [
      if (_error != null) ...[
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(12)),
          child:
              Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C))),
        ),
        const SizedBox(height: 20)
      ],
      _summaryCard(),
      const SizedBox(height: 20),
      _checkInCard(),
      if (_group != null) ...[
        const SizedBox(height: 20),
        _groupCard(),
      ],
      const SizedBox(height: 20),
      _manifestCard(),
    ]);
  }

  Widget _summaryCard() {
    final summary = _summary;
    final total = _int(summary['total']);
    final present = _int(summary['present']);
    return _card(Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(
          spacing: 16,
          runSpacing: 10,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            const Text('Passenger Attendance',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: shoreInk)),
            if (_finalized)
              _pill('Finalized by ${_manifest?['finalizedBy'] ?? 'Officer'}',
                  const Color(0xFFEEF2FF), shoreIndigo)
          ],
        ),
        const SizedBox(height: 4),
        Text('$present of $total passengers are Present',
            style: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w600, color: shoreIndigo)),
        const SizedBox(height: 20),
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: LinearProgressIndicator(
              minHeight: 8,
              value: total == 0 ? 0 : present / total,
              color: const Color(0xFF10B981),
              backgroundColor: const Color(0xFFF1F5F9)),
        ),
        const SizedBox(height: 20),
        LayoutBuilder(builder: (context, constraints) {
          final width = constraints.maxWidth >= 700
              ? (constraints.maxWidth - 36) / 4
              : (constraints.maxWidth - 12) / 2;
          return Wrap(spacing: 12, runSpacing: 12, children: [
            _metric('Present Today', present, const Color(0xFF059669), width),
            _metric('Not Present', _int(summary['notPresent']),
                const Color(0xFFDC2626), width),
            _metric('Not Yet Checked', _int(summary['notChecked']),
                const Color(0xFF64748B), width),
            _metric('Total Registered', total, shoreInk, width),
          ]);
        })
      ]),
    ));
  }

  Widget _checkInCard() => _card(Padding(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          LayoutBuilder(builder: (context, constraints) {
            final title = const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Passenger Check-In',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: shoreInk)),
                  SizedBox(height: 4),
                  Text(
                      'Scan the primary passenger’s personal QR to retrieve their registered group.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)))
                ]);
            final scan = FilledButton.icon(
                onPressed: _finalized || _busy ? null : _showScanner,
                style: FilledButton.styleFrom(
                    backgroundColor: shoreInk,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14)),
                icon: const Icon(Icons.camera_alt_outlined, size: 18),
                label: const Text('Scan Passenger QR'));
            return constraints.maxWidth >= 620
                ? Row(children: [Expanded(child: title), scan])
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                        title,
                        const SizedBox(height: 14),
                        SizedBox(width: double.infinity, child: scan)
                      ]);
          }),
          const SizedBox(height: 20),
          TextField(
            controller: _searchController,
            enabled: !_finalized,
            onChanged: _queueSearch,
            style: mobileSearchTextStyle,
            decoration: mobileSearchDecoration(
                'Search passenger name, reference, or registration ID'),
          ),
          if (_results.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8)),
              child: Column(
                  children: _results
                      .map((item) => ListTile(
                            onTap: () => _openSearch(
                                item['primaryPassengerId'].toString()),
                            title: Text(
                                item['primaryPassengerName']?.toString() ?? '',
                                style: const TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w600)),
                            subtitle: Text(
                                item['passengerReference']?.toString() ?? ''),
                            trailing: Text(
                                '${item['memberCount'] ?? 0} passengers\n${item['alreadyProcessed'] == true ? 'Checked' : 'Not checked'}',
                                textAlign: TextAlign.right,
                                style: const TextStyle(fontSize: 11)),
                          ))
                      .toList()),
            )
          ]
        ]),
      ));

  Widget _groupCard() {
    final group = _group!;
    final members = _maps(group['members']);
    final finalized = group['finalized'] == true;
    return _card(Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('${group['primaryPassengerName']}’s Group',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: shoreInk)),
                const SizedBox(height: 4),
                Text(
                    'Primary reference: ${group['primaryPassengerReference']} · Trip ${group['tripId']}',
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF64748B))),
                if (group['alreadyProcessed'] == true) ...[
                  const SizedBox(height: 8),
                  const Text(
                      'This passenger group has already been checked. Existing statuses are shown below.',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: shoreIndigo))
                ]
              ])),
          IconButton(
              tooltip: 'Close group',
              onPressed: () => setState(() => _group = null),
              icon: const Icon(Icons.close, color: shoreMuted))
        ]),
        const SizedBox(height: 20),
        ...members.map((member) {
          final id = member['passengerId']?.toString() ?? '';
          final status = _statuses[id] ?? 'NotChecked';
          return Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(8)),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(member['name']?.toString() ?? '',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, color: shoreInk)),
              const SizedBox(height: 4),
              Text(
                  '${member['relationship']} · ${member['passengerReference']} · ${member['phoneNumber']}',
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              const SizedBox(height: 8),
              _statusBadge(status),
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                _statusButton(id, 'Present', 'Present', status,
                    const Color(0xFF10B981), finalized),
                _statusButton(id, 'NotPresent', 'Not Present', status,
                    const Color(0xFFEF4444), finalized),
                _statusButton(id, 'NotChecked', 'Not Yet Checked', status,
                    const Color(0xFF64748B), finalized),
              ])
            ]),
          );
        }),
        if (!finalized)
          SizedBox(
              width: double.infinity,
              child: FilledButton(
                  onPressed: _busy ? null : _reviewGroup,
                  style: FilledButton.styleFrom(backgroundColor: shoreIndigo),
                  child: Text(_busy ? 'Saving...' : 'Confirm Attendance')))
      ]),
    ));
  }

  Widget _manifestCard() {
    final passengers = _maps(_manifest?['passengers']);
    final total = _int(_summary['total']);
    return _card(
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: LayoutBuilder(builder: (context, constraints) {
          final title = const Text('Passenger Manifest',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w600, color: shoreInk));
          final complete = OutlinedButton(
              onPressed:
                  _finalized || total == 0 || _busy ? null : _reviewFinalize,
              style: OutlinedButton.styleFrom(
                  foregroundColor: shoreIndigo,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8))),
              child: const Text('Complete Passenger Verification'));
          return constraints.maxWidth >= 560
              ? Row(children: [Expanded(child: title), complete])
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  title,
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, child: complete)
                ]);
        }),
      ),
      const Divider(height: 1),
      if (passengers.isEmpty)
        const Padding(
          padding: EdgeInsets.all(32),
          child: Center(
              child: Text(
                  'No registered passenger records are available for this trip yet.',
                  style: TextStyle(fontSize: 12, color: shoreMuted))),
        )
      else
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(const Color(0xFFF8FAFC)),
            headingTextStyle: const TextStyle(
                fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
            columns: const [
              DataColumn(label: Text('Passenger')),
              DataColumn(label: Text('Reference')),
              DataColumn(label: Text('Group / Relationship')),
              DataColumn(label: Text('Status')),
              DataColumn(label: Text('Check-in Time')),
            ],
            rows: passengers
                .map((person) => DataRow(cells: [
                      DataCell(Text(person['name']?.toString() ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w600))),
                      DataCell(
                          Text(person['passengerReference']?.toString() ?? '')),
                      DataCell(Text(person['relationship']?.toString() ?? '')),
                      DataCell(_statusBadge(
                          person['status']?.toString() ?? 'NotChecked')),
                      DataCell(Text(person['checkedAtUtc'] == null
                          ? '–'
                          : formatShoreDate(person['checkedAtUtc']))),
                    ]))
                .toList(),
          ),
        )
    ]));
  }

  Widget _statusButton(String passengerId, String value, String label,
          String current, Color color, bool disabled) =>
      OutlinedButton(
        onPressed: disabled
            ? null
            : () => setState(() => _statuses[passengerId] = value),
        style: OutlinedButton.styleFrom(
            backgroundColor: current == value ? color : Colors.white,
            foregroundColor:
                current == value ? Colors.white : const Color(0xFF475569),
            side: BorderSide(
                color: current == value ? color : const Color(0xFFE2E8F0))),
        child: Text(label, style: const TextStyle(fontSize: 12)),
      );

  Widget _statusBadge(String status) {
    final present = status == 'Present';
    final absent = status == 'NotPresent';
    return _pill(
        absent
            ? 'Not Present'
            : present
                ? 'Present'
                : 'Not Yet Checked',
        present
            ? const Color(0xFFECFDF5)
            : absent
                ? const Color(0xFFFEF2F2)
                : const Color(0xFFF1F5F9),
        present
            ? const Color(0xFF047857)
            : absent
                ? const Color(0xFFB91C1C)
                : const Color(0xFF475569));
  }

  Widget _pill(String text, Color background, Color foreground) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
            color: background, borderRadius: BorderRadius.circular(20)),
        child: Text(text,
            style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w600, color: foreground)),
      );

  Widget _metric(String label, int value, Color color, double width) =>
      Container(
        width: width,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(8)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          const SizedBox(height: 4),
          Text('$value',
              style: TextStyle(
                  fontSize: 24, fontWeight: FontWeight.bold, color: color))
        ]),
      );

  Widget _card(Widget child) => Container(
        width: double.infinity,
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: const [
              BoxShadow(color: Color(0x0D0F172A), blurRadius: 14)
            ]),
        child: child,
      );

  static List<Map<String, dynamic>> _maps(Object? value) =>
      ((value as List?) ?? const [])
          .whereType<Map>()
          .map((item) => item.cast<String, dynamic>())
          .toList();

  static int _int(Object? value) =>
      value is int ? value : int.tryParse(value?.toString() ?? '') ?? 0;

  static String _message(Object error) =>
      error.toString().replaceFirst('Exception: ', '');
}

class _QrScannerDialog extends StatefulWidget {
  const _QrScannerDialog();

  @override
  State<_QrScannerDialog> createState() => _QrScannerDialogState();
}

class _QrScannerDialogState extends State<_QrScannerDialog> {
  final _manual = TextEditingController();
  final _scanner = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      formats: const [BarcodeFormat.qrCode]);
  bool _submitted = false;

  @override
  void dispose() {
    _manual.dispose();
    unawaited(_scanner.dispose());
    super.dispose();
  }

  void _submit(String? value) {
    final clean = value?.trim() ?? '';
    if (_submitted || clean.isEmpty) return;
    _submitted = true;
    Navigator.pop(context, clean);
  }

  @override
  Widget build(BuildContext context) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                const Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text('Scan Passenger QR',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: shoreInk)),
                      SizedBox(height: 4),
                      Text('Point the camera at the passenger QR code.',
                          style: TextStyle(fontSize: 12, color: shoreMuted))
                    ])),
                IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close))
              ]),
              const SizedBox(height: 16),
              AspectRatio(
                aspectRatio: 16 / 10,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: ColoredBox(
                    color: Colors.black,
                    child: MobileScanner(
                      controller: _scanner,
                      onDetect: (capture) =>
                          _submit(capture.barcodes.firstOrNull?.rawValue),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                    child: TextField(
                  controller: _manual,
                  onSubmitted: _submit,
                  decoration: const InputDecoration(
                      hintText: 'Paste or enter QR value',
                      border: OutlineInputBorder()),
                )),
                const SizedBox(width: 8),
                FilledButton(
                    onPressed: () => _submit(_manual.text),
                    style: FilledButton.styleFrom(backgroundColor: shoreInk),
                    child: const Text('Validate'))
              ])
            ]),
          ),
        ),
      );
}
