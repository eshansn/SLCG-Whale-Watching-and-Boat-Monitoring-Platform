import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_service.dart';
import '../../widgets/shore_layout.dart';
import 'shore_wildlife_common.dart';

class ShoreWildlifeRecordsScreen extends StatefulWidget {
  const ShoreWildlifeRecordsScreen({super.key});

  @override
  State<ShoreWildlifeRecordsScreen> createState() =>
      _ShoreWildlifeRecordsScreenState();
}

class _ShoreWildlifeRecordsScreenState
    extends State<ShoreWildlifeRecordsScreen> {
  final _api = ApiService.instance;
  List<Map<String, dynamic>> _records = const [];
  bool _loading = true;
  bool _requestInFlight = false;
  String? _error;
  String? _openId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_requestInFlight) return;
    _requestInFlight = true;
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final records = await _api.shoreWildlifeRecords();
      if (!mounted) return;
      setState(() {
        _records = records;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = wildlifeError(error);
      });
    } finally {
      _requestInFlight = false;
    }
  }

  Future<void> _download(
      Map<String, dynamic> record, BuildContext anchorContext) async {
    final safe = wildlifeRecordForExport(record);
    final ticket = record['ticketNumber']?.toString() ?? 'record';
    final fileTicket = ticket.replaceAll(RegExp(r'[<>:"/\\|?*]'), '-');
    final fileName = 'wildlife-monitoring-$fileTicket.json';
    final box = anchorContext.findRenderObject() as RenderBox?;
    final origin =
        box == null ? null : box.localToGlobal(Offset.zero) & box.size;
    try {
      await SharePlus.instance.share(
        ShareParams(
          files: [
            XFile.fromData(
              utf8.encode(const JsonEncoder.withIndent('  ').convert(safe)),
              mimeType: 'application/json',
            ),
          ],
          fileNameOverrides: [fileName],
          subject: 'Wildlife monitoring record $ticket',
          sharePositionOrigin: origin,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(wildlifeError(error))),
      );
    }
  }

  @override
  Widget build(BuildContext context) => ShoreLayout(
        portal: ShorePortal.wildlife,
        active: 'records',
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
                          title: 'Monitoring Records',
                          subtitle:
                              'View and download finalized attendance snapshots',
                        ),
                        const SizedBox(height: 24),
                        if (_loading)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.all(44),
                              child: CircularProgressIndicator(),
                            ),
                          )
                        else if (_error != null)
                          WildlifeErrorPanel(message: _error!, retry: _load)
                        else if (_records.isEmpty)
                          const WildlifeEmptyPanel(
                              'No monitoring records are available.')
                        else
                          ..._records.map(_recordCard),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

  Widget _recordCard(Map<String, dynamic> record) {
    final id = record['id']?.toString() ?? '';
    final open = _openId == id;
    final tripId = record['tripId']?.toString() ?? '';
    final shortTrip = tripId.length > 8 ? tripId.substring(0, 8) : tripId;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: WildlifeCard(
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() => _openId = open ? null : id),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(record['ticketNumber']?.toString() ?? '',
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 5),
                        Text(
                          'Trip $shortTrip · ${record['totalPresent'] ?? 0} present · ${formatShoreDate(record['createdAtUtc'])}',
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(open ? 'Hide' : 'View',
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: shoreIndigo)),
                  const SizedBox(width: 4),
                  Icon(open ? Icons.arrow_drop_up : Icons.arrow_drop_down,
                      color: shoreIndigo),
                ]),
              ),
            ),
            if (open) ...[
              const Divider(height: 1, color: Color(0xFFE2E8F0)),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LayoutBuilder(builder: (context, constraints) {
                      final fields = [
                        ('TID', record['tidNumber']),
                        ('Monitoring Officer', record['monitoringOfficer']),
                        ('Supervisor', record['supervisor']),
                        (
                          'Harbour Officer',
                          record['harbourOfficerName'] ?? '—'
                        ),
                        (
                          'Local snapshot',
                          wildlifeMap(record['local'])['total'] ?? 0
                        ),
                        (
                          'Foreign snapshot',
                          wildlifeMap(record['foreign'])['total'] ?? 0
                        ),
                      ];
                      final columns = constraints.maxWidth >= 720
                          ? 3
                          : constraints.maxWidth >= 440
                              ? 2
                              : 1;
                      final width =
                          (constraints.maxWidth - (columns - 1) * 14) / columns;
                      return Wrap(
                        spacing: 14,
                        runSpacing: 16,
                        children: fields
                            .map((field) => SizedBox(
                                  width: width,
                                  child: _info(
                                      field.$1, field.$2?.toString() ?? '—'),
                                ))
                            .toList(),
                      );
                    }),
                    const SizedBox(height: 20),
                    LayoutBuilder(builder: (context, constraints) {
                      final signatures = [
                        (
                          record['monitoringOfficerSignature'],
                          'Monitoring Officer'
                        ),
                        (record['supervisorSignature'], 'Supervisor'),
                        (record['harbourOfficerSignature'], 'Harbour Officer'),
                      ];
                      if (constraints.maxWidth >= 620) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: signatures
                              .map((signature) => Expanded(
                                    child: Padding(
                                      padding: EdgeInsets.only(
                                          right: signature == signatures.last
                                              ? 0
                                              : 10),
                                      child: _signature(
                                        signature.$2,
                                        signature.$1?.toString(),
                                      ),
                                    ),
                                  ))
                              .toList(),
                        );
                      }
                      return Column(
                        children: signatures
                            .map((signature) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _signature(
                                    signature.$2,
                                    signature.$1?.toString(),
                                  ),
                                ))
                            .toList(),
                      );
                    }),
                    const SizedBox(height: 18),
                    Builder(builder: (buttonContext) {
                      return FilledButton.icon(
                        onPressed: () => _download(record, buttonContext),
                        style: FilledButton.styleFrom(
                          backgroundColor: shoreInk,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 18, vertical: 13),
                        ),
                        icon: const Icon(Icons.download_outlined, size: 18),
                        label: const Text('Download Record',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

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

  Widget _signature(String label, String? source) {
    final bytes = _signatureBytes(source);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFE2E8F0)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          if (bytes == null)
            const SizedBox(
              height: 74,
              child: Align(
                alignment: Alignment.topLeft,
                child: Text('Not signed',
                    style: TextStyle(fontSize: 12, color: shoreMuted)),
              ),
            )
          else
            Image.memory(
              bytes,
              height: 74,
              width: double.infinity,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const SizedBox(
                height: 74,
                child: Text('Signature unavailable',
                    style: TextStyle(fontSize: 12, color: shoreMuted)),
              ),
            ),
        ],
      ),
    );
  }

  Uint8List? _signatureBytes(String? source) {
    if (!wildlifePresent(source)) return null;
    try {
      return base64Decode(source!.split(',').last);
    } catch (_) {
      return null;
    }
  }
}
