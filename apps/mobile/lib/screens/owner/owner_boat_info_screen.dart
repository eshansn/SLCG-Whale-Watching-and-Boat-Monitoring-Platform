import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class _DocumentRequirement {
  final String type;
  final String name;
  final bool renewable;
  const _DocumentRequirement(this.type, this.name, {this.renewable = false});
}

class OwnerBoatInfoScreen extends StatefulWidget {
  const OwnerBoatInfoScreen({super.key});

  @override
  State<OwnerBoatInfoScreen> createState() => _OwnerBoatInfoScreenState();
}

class _OwnerBoatInfoScreenState extends State<OwnerBoatInfoScreen> {
  static const _requirements = [
    _DocumentRequirement('VesselPhotographOrDiagram',
        'Color Aerial Photograph or Diagram of the Vessel'),
    _DocumentRequirement('BusinessRegistration',
        'Certificate of Registration of Sole Proprietorship / Business'),
    _DocumentRequirement('MECertificate', 'ME Certificate', renewable: true),
    _DocumentRequirement(
        'VesselInsuranceCertificate', 'Vessel Insurance Certificate',
        renewable: true),
    _DocumentRequirement('PassengerLifeInsuranceCertificate',
        "Passengers' Life Insurance Certificate",
        renewable: true),
    _DocumentRequirement('WildlifeCertificate', 'Wildlife Certificate'),
    _DocumentRequirement('CoxswainCertificate', 'Coxswain Certificate'),
    _DocumentRequirement(
        'VesselRegistrationCertificate', 'Vessel Registration Certificate',
        renewable: true),
    _DocumentRequirement('LifeSavingCertificate', 'Life Saving Certificate'),
    _DocumentRequirement('FirstAidCertificate', 'First Aid Certificate',
        renewable: true),
    _DocumentRequirement(
        'FireFightingEquipmentReport', 'Fire-Fighting Equipment Report',
        renewable: true),
    _DocumentRequirement(
        'FireFightingCertificate', 'Fire Fighting Certificate'),
  ];

  final _api = ApiService.instance;
  String? _id;
  Map<String, dynamic>? _boat;
  bool _loading = true;
  String? _error;
  String? _downloadingId;
  String? _uploadingType;

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

  String _contentType(String extension) => switch (extension.toLowerCase()) {
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' || 'jpeg' => 'image/jpeg',
        _ => 'application/octet-stream',
      };

  Future<void> _uploadReplacement(_DocumentRequirement requirement) async {
    if (_boat == null || _uploadingType != null) return;
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: requirement.type == 'VesselPhotographOrDiagram'
          ? const ['jpg', 'jpeg', 'png']
          : const ['pdf', 'jpg', 'jpeg', 'png'],
      withData: true,
    );
    final file = result?.files.single;
    if (file?.bytes == null) {
      return;
    }
    if (file!.bytes!.isEmpty || file.bytes!.length > 10 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Document must be between 1 byte and 10 MB.')));
      }
      return;
    }
    setState(() => _uploadingType = requirement.type);
    try {
      await _api.uploadBoatDocument(_boat!['id'].toString(), requirement.type,
          file.bytes!, file.name, _contentType(file.extension ?? ''));
      await _load(silent: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(requirement.renewable
                ? 'Renewal uploaded for Wildlife review.'
                : 'Replacement uploaded for Wildlife review.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ownerError(error))));
      }
    } finally {
      if (mounted) {
        setState(() => _uploadingType = null);
      }
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
    final displayedRequirements = <_DocumentRequirement>[];
    if ((boat['documentRequirementsVersion'] as num? ?? 1) >= 2) {
      displayedRequirements.addAll(_requirements);
    } else {
      for (final document in documents) {
        final type =
            document['documentType']?.toString() ?? 'LegacyUnclassified';
        if (displayedRequirements.any((item) => item.type == type)) continue;
        _DocumentRequirement? known;
        for (final requirement in _requirements) {
          if (requirement.type == type) known = requirement;
        }
        displayedRequirements.add(known ??
            _DocumentRequirement(
                type, document['name']?.toString() ?? 'Legacy vessel document',
                renewable: document['expirationDate'] != null));
      }
    }
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
      const Text('Current Documents',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
      const SizedBox(height: 12),
      OwnerCard(
        child: Column(
          children: displayedRequirements.map<Widget>((requirement) {
            final versions = documents
                .where((candidate) =>
                    candidate['documentType']?.toString() == requirement.type)
                .toList()
              ..sort((a, b) => (b['version'] as num? ?? 0)
                  .compareTo(a['version'] as num? ?? 0));
            Map<String, dynamic>? document;
            for (final candidate in versions) {
              if (candidate['isCurrent'] == true) {
                document = candidate;
                break;
              }
            }
            document ??= versions.isEmpty ? null : versions.first;
            final loading = document != null &&
                _downloadingId == document['id']?.toString();
            return ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(requirement.name,
                  style: const TextStyle(fontWeight: FontWeight.w500)),
              subtitle: document == null
                  ? const Text('Not uploaded')
                  : Text([
                      'Version ${document['version'] ?? 1}',
                      document['fileName']?.toString() ?? '',
                      'Status: ${document['renewalState'] ?? document['status'] ?? 'Unknown'}',
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
              children: [
                if (document != null)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.visibility_outlined),
                    title: const Text('View current/latest document'),
                    onTap: _downloadingId == null
                        ? () => _download(document!)
                        : null,
                  ),
                ...versions.map((version) => ListTile(
                      dense: true,
                      title: Text('Version ${version['version'] ?? 1}'
                          '${version['isCurrent'] == true ? ' · Current' : ''}'),
                      subtitle: Text(
                          'Uploaded ${version['uploadedAtUtc'] ?? ''}\nStatus: ${version['renewalState'] ?? version['status'] ?? ''}'),
                      trailing: const Icon(Icons.download_outlined),
                      onTap: () => _download(version),
                    )),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: _uploadingType == null
                        ? () => _uploadReplacement(requirement)
                        : null,
                    icon: const Icon(Icons.upload_file_outlined),
                    label: Text(_uploadingType == requirement.type
                        ? 'Uploading...'
                        : requirement.renewable
                            ? 'Renew Document'
                            : 'Replace Document'),
                  ),
                ),
              ],
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
