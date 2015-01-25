(function (angular) {
'use strict';

angular.module('ngParticleFuntime', [])

.directive('myCustomer', function() {
    return {
      restrict: 'E',
		template: '<div>myCustomer</div>',
    };
  })

.directive('particleFunTime', function ($compile, $parse) {
	return {
		restrict: 'E',
	    scope: {
	        options: "="
	    },
		link: function ($scope, $element, $attributes) {
			$scope.pft = new ParticleFunTime($element[0], $scope.options);
            //$scope.options = $.extend({}, $scope.pft.options);
            
			$scope.$watch('options', function(newValue, oldValue) {
				var needsReset = false;

				var pft = $scope.pft;
				var options = pft.options;

				for (var prop in newValue) {
					if (newValue[prop] !== options[prop]) {
						switch (prop) {
							case "running":
								options.running = newValue.running;
								if (options.running) {
									pft.displayFrame();
								}
							break;
                                
                            case "theme":
                                needsReset = true;
                                break;
						}
                        pft.options[prop] = newValue[prop];
                        //$scope.options[prop] = newValue[prop];
                        console.log("new " + prop + " is " + newValue[prop]);
					}
				}

                if (needsReset) {
                    pft.reset(newValue);
                }

            }, true);

		}
	};
});

})(angular);