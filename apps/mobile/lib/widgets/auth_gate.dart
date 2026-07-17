import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthGate extends StatelessWidget {
 final Widget child; final List<String> roles;
 const AuthGate({super.key,required this.child,required this.roles});
 @override Widget build(BuildContext context){final role=ApiService.instance.role;if(role==null){WidgetsBinding.instance.addPostFrameCallback((_){if(context.mounted)Navigator.pushNamedAndRemoveUntil(context,'/login',(_)=>false);});return const Scaffold(body:Center(child:CircularProgressIndicator()));}if(!roles.contains(role)){return Scaffold(body:Center(child:Column(mainAxisSize:MainAxisSize.min,children:[const Text('Access denied'),TextButton(onPressed:()=>Navigator.pushNamedAndRemoveUntil(context,'/',(_)=>false),child:const Text('Return'))])));}return child;}
}
