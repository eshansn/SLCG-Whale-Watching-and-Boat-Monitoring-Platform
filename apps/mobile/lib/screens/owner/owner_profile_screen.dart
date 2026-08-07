import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class OwnerProfileScreen extends StatefulWidget {
  const OwnerProfileScreen({super.key});

  @override
  State<OwnerProfileScreen> createState() => _OwnerProfileScreenState();
}

class _OwnerProfileScreenState extends State<OwnerProfileScreen> {
  final _api = ApiService.instance;
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _bio = TextEditingController();
  Map<String, dynamic>? _profile;
  Uint8List? _photo;
  bool _loading = true;
  bool _saving = false;
  bool _uploadingPhoto = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _email.dispose();
    _phone.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final result = await Future.wait<Object?>([
        _api.ownerProfile(),
        _api.ownerProfilePhoto(),
      ]);
      if (!mounted) return;
      final profile = Map<String, dynamic>.from(result[0] as Map);
      setState(() {
        _profile = profile;
        _photo = result[1] as Uint8List?;
        _email.text = '${profile['email'] ?? ''}';
        _phone.text = '${profile['phoneNumber'] ?? ''}';
        _bio.text = '${profile['bio'] ?? ''}';
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = ownerError(error);
        _loading = false;
      });
    }
  }

  Future<void> _pickPhoto() async {
    final selected = await FilePicker.pickFiles(
      type: FileType.image,
      withData: true,
      allowMultiple: false,
    );
    final file = selected?.files.single;
    if (file == null) return;
    if (file.bytes == null) {
      _message('Unable to read the selected photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      _message('Use a JPEG, PNG, or WebP photo under 5 MB.');
      return;
    }
    final extension = (file.extension ?? '').toLowerCase();
    final contentType = switch (extension) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => '',
    };
    if (contentType.isEmpty) {
      _message('Use a JPEG, PNG, or WebP photo under 5 MB.');
      return;
    }
    setState(() => _uploadingPhoto = true);
    try {
      await _api.uploadOwnerPhotoBytes(file.bytes!, file.name, contentType);
      if (!mounted) return;
      setState(() => _photo = file.bytes);
      _message('Profile picture updated.');
    } catch (error) {
      if (mounted) _message(ownerError(error));
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final profile = await _api.updateOwnerProfile(
        email: _email.text.trim(),
        phoneNumber: _phone.text.trim(),
        bio: _bio.text.trim(),
      );
      if (!mounted) return;
      setState(() => _profile = profile);
      _message('Profile updated successfully.');
    } catch (error) {
      if (mounted) setState(() => _error = ownerError(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _message(String value) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(value)));

  @override
  Widget build(BuildContext context) => OwnerLayout(
        active: 'profile',
        title: 'Profile',
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _profile == null
                ? ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      OwnerErrorPanel(
                          message: _error ?? 'Unable to load profile.',
                          retry: _load)
                    ],
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: Form(
                      key: _formKey,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
                        children: [
                          OwnerCard(
                            child: Row(
                              children: [
                                Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    OwnerProfileImage(
                                        bytes: _photo, radius: 42),
                                    Positioned(
                                      right: -5,
                                      bottom: -5,
                                      child: IconButton.filled(
                                        tooltip: 'Change photo',
                                        onPressed:
                                            _uploadingPhoto ? null : _pickPhoto,
                                        icon: _uploadingPhoto
                                            ? const SizedBox(
                                                width: 15,
                                                height: 15,
                                                child:
                                                    CircularProgressIndicator(
                                                        strokeWidth: 2))
                                            : const Icon(
                                                Icons.camera_alt_rounded,
                                                size: 17),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 18),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text('${_profile!['displayName']}',
                                          style: const TextStyle(
                                              fontSize: 21,
                                              fontWeight: FontWeight.w700)),
                                      Text('${_profile!['userName']}',
                                          style: const TextStyle(
                                              color: ownerMuted)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          OwnerCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _label('NIC No.'),
                                _readOnly(
                                    '${_profile!['nicNumber'] ?? 'Not provided'}'),
                                _label('Your Email'),
                                TextFormField(
                                  controller: _email,
                                  keyboardType: TextInputType.emailAddress,
                                  decoration: const InputDecoration(
                                      prefixIcon: Icon(Icons.mail_outline)),
                                  validator: (value) {
                                    final email = value?.trim() ?? '';
                                    if (email.isEmpty ||
                                        !email.contains('@') ||
                                        !email.contains('.')) {
                                      return 'Enter a valid email address.';
                                    }
                                    return null;
                                  },
                                ),
                                _label('Phone Number'),
                                TextFormField(
                                  controller: _phone,
                                  keyboardType: TextInputType.phone,
                                  decoration: const InputDecoration(
                                      prefixIcon: Icon(Icons.phone_outlined)),
                                  validator: (value) =>
                                      (value?.trim().isEmpty ?? true)
                                          ? 'Phone number is required.'
                                          : null,
                                ),
                                _label('About'),
                                TextFormField(
                                  controller: _bio,
                                  maxLines: 4,
                                  maxLength: 1000,
                                  decoration: const InputDecoration(
                                      hintText: 'Add a short biography'),
                                ),
                              ],
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 12),
                            Text(_error!,
                                style: const TextStyle(color: Colors.red)),
                          ],
                          const SizedBox(height: 22),
                          FilledButton(
                            onPressed: _saving ? null : _save,
                            child: Text(_saving ? 'Updating…' : 'Update'),
                          ),
                        ],
                      ),
                    ),
                  ),
      );

  Widget _label(String value) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 7),
        child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      );

  Widget _readOnly(String value) => InputDecorator(
        decoration: const InputDecoration(filled: true),
        child: Text(value),
      );
}
