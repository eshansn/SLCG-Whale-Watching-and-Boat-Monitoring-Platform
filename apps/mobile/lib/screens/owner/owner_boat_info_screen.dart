import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class OwnerBoatInfoScreen extends StatefulWidget {
  const OwnerBoatInfoScreen({super.key});

  @override
  State<OwnerBoatInfoScreen> createState() => _OwnerBoatInfoScreenState();
}

class _OwnerBoatInfoScreenState extends State<OwnerBoatInfoScreen> {
  static const _certificateNames = [
    'Certificate of registration of Sole Proprietorship',
    'ME Certificate',
    'Certificate of Vessel',
    'Wildlife Certificate',
    'Coxswain Certificate',
    'Vessel Registration Certificate',
    'Boat Insurance',
  ];

  final _api = ApiService.instance;
  String? _id;
  Map<String, dynamic>? _boat;
  bool _loading = true;
  String? _error;
  String? _downloadingId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_id != null) return;
    _id = ModalRoute.of(context)?.settings.arguments as String?;
    _api.addListener(_realtimeRefresh);
    _load();
  }

  @override
  void dispose() {
    _api.removeListener(_realtimeRefresh);
    super.dispose();
  }

  void _realtimeRefresh() => _load(silent: true);

  Future<void> _load({bool silent = false}) async {
    if (_id == null) {
      setState(() {
        _loading = false;
        _error = 'Vessel information was not supplied.';
      });
      return;
    }
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final boats = await _api.boats();
      Map<String, dynamic>? selected;
      for (final boat in boats) {
        if (boat['id']?.toString() == _id) {
          selected = boat;
          break;
        }
      }
      if (!mounted) return;
      setState(() {
        _boat = selected;
        _loading = false;
        _error = selected == null ? 'Vessel not found.' : null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (!silent) _error = ownerError(error);
      });
    }
  }

  Future<void> _download(Map<String, dynamic> document) async {
    final id = document['id']?.toString() ?? '';
    if (_boat == null || id.isEmpty || _downloadingId != null) return;
    setState(() => _downloadingId = id);
    try {
      final file = await _api.downloadBoatDocument(
        _boat!['id'].toString(),
        id,
        document['fileName']?.toString() ?? 'certificate',
        document['contentType']?.toString() ?? 'application/octet-stream',
      );
      await SharePlus.instance.share(
        ShareParams(
          title: document['name']?.toString() ?? 'Boat certificate',
          files: [
            XFile.fromData(
              file.bytes,
              mimeType: file.contentType,
              name: file.fileName,
            ),
          ],
          fileNameOverrides: [file.fileName],
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ownerError(error))));
      }
    } finally {
      if (mounted) setState(() => _downloadingId = null);
    }
  }

  @override
  Widget build(BuildContext context) => OwnerLayout(
        active: 'boats',
        title: 'Boat Information',
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
            children: [
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 90),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                OwnerErrorPanel(message: _error!, retry: _load)
              else
                ..._content(),
            ],
          ),
        ),
      );

  List<Widget> _content() {
    final boat = _boat!;
    final documents = ownerMaps(boat['documents']);
    return [
      LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 650;
          final details = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(boat['name']?.toString() ?? 'Unnamed vessel',
                  style: const TextStyle(
                      fontSize: 23, fontWeight: FontWeight.w600)),
              const SizedBox(height: 5),
              Text(boat['registrationNumber']?.toString() ?? '',
                  style: const TextStyle(fontSize: 17)),
              const SizedBox(height: 10),
              OwnerStatusBadge(boat['approval']),
            ],
          );
          return OwnerCard(
            child: wide
                ? Row(
                    children: [
                      SizedBox(width: 220, child: details),
                      const SizedBox(width: 24),
                      Expanded(
                          child: OwnerBoatImage(boat['imageUrl'], height: 230)),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      OwnerBoatImage(boat['imageUrl'], height: 190),
                      const SizedBox(height: 18),
                      details,
                    ],
                  ),
          );
        },
      ),
      const SizedBox(height: 18),
      OwnerCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Vessel Information',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 14),
            _value('Registration date', boat['registrationDate']),
            _value('Hull number', boat['hullNumber']),
            _value('Length', '${boat['lengthMeters'] ?? 0} m'),
            _value('Beam (width)', '${boat['widthMeters'] ?? 0} m'),
            _value('Maximum speed', '${boat['maximumSpeedKnots'] ?? 0} knots'),
            _value('Maximum passengers', boat['maximumCapacity']),
            _value('Life jackets', boat['lifeJacketCount']),
          ],
        ),
      ),
      const SizedBox(height: 22),
      const Text('Certifications',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
      const SizedBox(height: 12),
      OwnerCard(
        child: Column(
          children: _certificateNames.map((name) {
            Map<String, dynamic>? document;
            for (final candidate in documents) {
              if (candidate['name']?.toString() == name) {
                document = candidate;
                break;
              }
            }
            final loading = document != null &&
                _downloadingId == document['id']?.toString();
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(name,
                  style: const TextStyle(fontWeight: FontWeight.w500)),
              subtitle: document == null
                  ? const Text('Not uploaded')
                  : Text([
                      document['fileName']?.toString() ?? '',
                      if (document['expirationDate'] != null)
                        'Expires ${document['expirationDate']}'
                    ].join('\n')),
              trailing: loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(document == null
                      ? Icons.description_outlined
                      : Icons.download_outlined),
              enabled: document != null && _downloadingId == null,
              onTap: document == null ? null : () => _download(document!),
            );
          }).toList(),
        ),
      ),
    ];
  }

  Widget _value(String label, Object? value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
                child: Text(label,
                    style: const TextStyle(
                        color: ownerNavy, fontWeight: FontWeight.w600))),
            const SizedBox(width: 12),
            Flexible(
                child: Text(value?.toString() ?? 'Not available',
                    textAlign: TextAlign.right)),
          ],
        ),
      );
}
